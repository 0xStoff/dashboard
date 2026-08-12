import { ethers } from "ethers";
import { QueryTypes } from "sequelize";
import sequelize from "../sequelize.js";
import PoolRadarPool from "../models/PoolRadarPoolModel.js";
import PoolRadarSwap from "../models/PoolRadarSwapModel.js";
import PoolRadarState from "../models/PoolRadarStateModel.js";
import { annualizeFeeApy, decodeHookPermissions, deriveRiskFlags, feePipsToRate, WINDOW_SECONDS } from "./poolRadarMath.js";

const config = {
    chainId: Number(process.env.ROBINHOOD_CHAIN_ID || 4663),
    rpcUrl: process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: process.env.ROBINHOOD_EXPLORER_URL || "https://robinhoodchain.blockscout.com",
    usdg: (process.env.ROBINHOOD_USDG_ADDRESS || "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168").toLowerCase(),
    weth: (process.env.ROBINHOOD_WETH_ADDRESS || "0x0bd7d308f8e1639fab988df18a8011f41eacad73").toLowerCase(),
    v2Factory: (process.env.ROBINHOOD_V2_FACTORY || "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f").toLowerCase(),
    v3Factory: (process.env.ROBINHOOD_V3_FACTORY || "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA").toLowerCase(),
    v4Manager: (process.env.ROBINHOOD_V4_POOL_MANAGER || "0x8366a39cc670b4001a1121b8f6a443a643e40951").toLowerCase(),
    intervalMs: Number(process.env.POOL_RADAR_INDEX_INTERVAL_MS || 60_000),
    v4StartBlock: Number(process.env.POOL_RADAR_V4_START_BLOCK || 0),
    swapBackfillBlocks: Number(process.env.POOL_RADAR_SWAP_BACKFILL_BLOCKS || 10_000),
    swapChunkBlocks: Number(process.env.POOL_RADAR_SWAP_CHUNK_BLOCKS || 10_000),
};

const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true, batchMaxCount: 50 });
const factoryInterface = new ethers.Interface([
    "function getPair(address,address) view returns(address)",
    "function getPool(address,address,uint24) view returns(address)",
]);
const v2StateInterface = new ethers.Interface(["function getReserves() view returns(uint112 reserve0,uint112 reserve1,uint32)"]);
const tokenInterface = new ethers.Interface(["function balanceOf(address) view returns(uint256)"]);
const v2SwapInterface = new ethers.Interface(["event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"]);
const v3SwapInterface = new ethers.Interface(["event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)"]);
const v4Interface = new ethers.Interface([
    "event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)",
    "event Swap(bytes32 indexed id,address indexed sender,int128 amount0,int128 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick,uint24 fee)",
]);

const status = {
    phase: "starting",
    latestBlock: null,
    indexedThroughBlock: null,
    lastSuccessfulUpdate: null,
    metricsUpdatedAt: null,
    error: null,
    running: false,
    retryAt: null,
};

const isEthUsdg = (token0, token1) => {
    const tokens = [token0.toLowerCase(), token1.toLowerCase()];
    return tokens.includes(config.usdg) && (tokens.includes(config.weth) || tokens.includes(ethers.ZeroAddress));
};

const getState = async (key, fallback = null) => (await PoolRadarState.findByPk(key))?.value ?? fallback;
const setState = async (key, value) => PoolRadarState.upsert({ key, value });

const queryLogsAdaptive = async (filter, minSpan = 2_000) => {
    try {
        return await provider.getLogs(filter);
    } catch (error) {
        if (/429|rate.?limit/i.test(error?.message || "")) throw error;
        const from = Number(filter.fromBlock);
        const to = Number(filter.toBlock);
        if (to - from <= minSpan) throw error;
        const middle = Math.floor((from + to) / 2);
        const [left, right] = await Promise.all([
            queryLogsAdaptive({ ...filter, fromBlock: from, toBlock: middle }, minSpan),
            queryLogsAdaptive({ ...filter, fromBlock: middle + 1, toBlock: to }, minSpan),
        ]);
        return [...left, ...right];
    }
};

const upsertStandardPools = async () => {
    const [token0, token1] = [config.usdg, config.weth].sort();
    const pairData = factoryInterface.encodeFunctionData("getPair", [config.usdg, config.weth]);
    const pairResult = await provider.call({ to: config.v2Factory, data: pairData });
    const [pair] = factoryInterface.decodeFunctionResult("getPair", pairResult);
    if (pair !== ethers.ZeroAddress) {
        await PoolRadarPool.upsert({ id: pair.toLowerCase(), version: "v2", address: pair.toLowerCase(), token0, token1, feePips: 3000, createdBlock: 0, metadata: { discovery: "factory-call" } });
    }

    for (const feePips of [100, 500, 3000, 10_000]) {
        const data = factoryInterface.encodeFunctionData("getPool", [config.usdg, config.weth, feePips]);
        const result = await provider.call({ to: config.v3Factory, data });
        const [pool] = factoryInterface.decodeFunctionResult("getPool", result);
        if (pool !== ethers.ZeroAddress) {
            await PoolRadarPool.upsert({ id: pool.toLowerCase(), version: "v3", address: pool.toLowerCase(), token0, token1, feePips, createdBlock: 0, metadata: { discovery: "factory-call" } });
        }
    }
};

const indexV4Initializations = async (latestBlock) => {
    const cursor = Number(await getState("v4-discovery-cursor", config.v4StartBlock));
    if (cursor > latestBlock) return latestBlock;
    const toBlock = Math.min(cursor + 249_999, latestBlock);
    const logs = await queryLogsAdaptive({
        address: config.v4Manager,
        fromBlock: cursor,
        toBlock,
        topics: [v4Interface.getEvent("Initialize").topicHash],
    });
    for (const log of logs) {
        const parsed = v4Interface.parseLog(log);
        const token0 = String(parsed.args.currency0);
        const token1 = String(parsed.args.currency1);
        if (!isEthUsdg(token0, token1)) continue;
        const hook = String(parsed.args.hooks).toLowerCase();
        await PoolRadarPool.upsert({
            id: String(parsed.args.id).toLowerCase(), version: "v4", address: config.v4Manager,
            token0, token1, feePips: Number(parsed.args.fee), tickSpacing: Number(parsed.args.tickSpacing),
            hook, createdBlock: log.blockNumber,
            metadata: { discovery: "initialize-log", sqrtPriceX96: String(parsed.args.sqrtPriceX96), hookPermissions: decodeHookPermissions(hook) },
        });
    }
    await setState("v4-discovery-cursor", toBlock + 1);
    return toBlock;
};

const getBlockTimes = async (blockNumbers) => {
    const uniqueBlocks = [...new Set(blockNumbers)];
    const entries = [];
    for (let index = 0; index < uniqueBlocks.length; index += 10) {
        const batch = uniqueBlocks.slice(index, index + 10);
        entries.push(...await Promise.all(batch.map(async (blockNumber) => {
            const block = await provider.getBlock(blockNumber);
            return [blockNumber, block?.timestamp || 0];
        })));
        if (index + 10 < uniqueBlocks.length) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return new Map(entries);
};

const parseSwap = (pool, log, parsed, timestamp) => {
    const usdgIs0 = pool.token0.toLowerCase() === config.usdg;
    let rawVolume;
    let feePips = Number(pool.feePips || 0);
    if (pool.version === "v2") {
        rawVolume = usdgIs0
            ? BigInt(parsed.args.amount0In) + BigInt(parsed.args.amount0Out)
            : BigInt(parsed.args.amount1In) + BigInt(parsed.args.amount1Out);
    } else {
        const raw = BigInt(usdgIs0 ? parsed.args.amount0 : parsed.args.amount1);
        rawVolume = raw < 0n ? -raw : raw;
        if (pool.version === "v4") feePips = Number(parsed.args.fee);
    }
    const volumeUsd = Number(rawVolume) / 1e6;
    return {
        id: `${log.transactionHash}:${log.index}`,
        poolId: pool.id,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: new Date(timestamp * 1000),
        volumeUsd,
        lpFeeUsd: volumeUsd * feePipsToRate(feePips),
        feePips,
    };
};

const indexPoolSwaps = async (pool, latestBlock) => {
    const cursorKey = `swap-cursor:${pool.id}`;
    const defaultStart = Math.max(Number(pool.createdBlock || 0), latestBlock - config.swapBackfillBlocks);
    const cursor = Number(await getState(cursorKey, defaultStart));
    if (cursor > latestBlock) return;
    const toBlock = Math.min(cursor + config.swapChunkBlocks - 1, latestBlock);
    const swapInterface = pool.version === "v2" ? v2SwapInterface : pool.version === "v3" ? v3SwapInterface : v4Interface;
    const filter = {
        address: pool.version === "v4" ? config.v4Manager : pool.address,
        fromBlock: cursor,
        toBlock,
        topics: [swapInterface.getEvent("Swap").topicHash, ...(pool.version === "v4" ? [pool.id] : [])],
    };
    const logs = await queryLogsAdaptive(filter, 1_000);
    if (logs.length) {
        const times = await getBlockTimes(logs.map((log) => log.blockNumber));
        const rows = logs.map((log) => parseSwap(pool, log, swapInterface.parseLog(log), times.get(log.blockNumber) || 0));
        await PoolRadarSwap.bulkCreate(rows, { ignoreDuplicates: true });
    }
    await setState(cursorKey, toBlock + 1);
};

const readTvl = async (pool) => {
    try {
        if (pool.version === "v2") {
            const result = await provider.call({ to: pool.address, data: v2StateInterface.encodeFunctionData("getReserves") });
            const [reserve0, reserve1] = v2StateInterface.decodeFunctionResult("getReserves", result);
            const usdgReserve = pool.token0.toLowerCase() === config.usdg ? reserve0 : reserve1;
            return Number(usdgReserve) / 1e6 * 2;
        }
        if (pool.version === "v3") {
            const result = await provider.call({ to: config.usdg, data: tokenInterface.encodeFunctionData("balanceOf", [pool.address]) });
            const [balance] = tokenInterface.decodeFunctionResult("balanceOf", result);
            return Number(balance) / 1e6 * 2;
        }
    } catch (error) {
        console.warn(`Pool Radar TVL unavailable for ${pool.id}:`, error.message);
    }
    return null;
};

const refreshPoolMetrics = async (pool) => {
    const [aggregate] = await sequelize.query(`
        SELECT
            MAX(timestamp) AS "lastSwap",
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '5 minutes')::int AS "count5m",
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour')::int AS "count1h",
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '6 hours')::int AS "count6h",
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours')::int AS "count24h",
            COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days')::int AS "count7d",
            COALESCE(SUM(volume_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '5 minutes'), 0) AS "volume5m",
            COALESCE(SUM(volume_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour'), 0) AS "volume1h",
            COALESCE(SUM(volume_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '6 hours'), 0) AS "volume6h",
            COALESCE(SUM(volume_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours'), 0) AS "volume24h",
            COALESCE(SUM(volume_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days'), 0) AS "volume7d",
            COALESCE(SUM(lp_fee_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '5 minutes'), 0) AS "fees5m",
            COALESCE(SUM(lp_fee_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '1 hour'), 0) AS "fees1h",
            COALESCE(SUM(lp_fee_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '6 hours'), 0) AS "fees6h",
            COALESCE(SUM(lp_fee_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours'), 0) AS "fees24h",
            COALESCE(SUM(lp_fee_usd) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days'), 0) AS "fees7d"
        FROM pool_radar_swaps WHERE pool_id = :poolId
    `, { replacements: { poolId: pool.id }, type: QueryTypes.SELECT });
    const tvlUsd = await readTvl(pool);
    const windows = {};
    for (const [window, seconds] of Object.entries(WINDOW_SECONDS)) {
        const suffix = window;
        const swaps = Number(aggregate[`count${suffix}`] || 0);
        const volumeUsd = Number(aggregate[`volume${suffix}`] || 0);
        const feesUsd = Number(aggregate[`fees${suffix}`] || 0);
        windows[window] = { swaps, volumeUsd, feesUsd, apy: annualizeFeeApy({ feesUsd, tvlUsd, windowSeconds: seconds }), volumeTvl: tvlUsd > 0 ? volumeUsd / tvlUsd : null };
    }
    const dynamicFee = (Number(pool.feePips || 0) & 0x800000) !== 0;
    const metrics = {
        tvlUsd, windows, lastSwap: aggregate.lastSwap, dynamicFee,
        risks: deriveRiskFlags({ tvlUsd, windows, hook: pool.hook, dynamicFee }),
        source: "Robinhood Chain RPC + PostgreSQL aggregates",
        freshness: new Date().toISOString(),
    };
    await pool.update({ metrics });
};

const runCycle = async () => {
    if (status.running) return;
    if (status.retryAt && Date.now() < new Date(status.retryAt).getTime()) return;
    status.running = true;
    status.phase = "indexing";
    status.error = null;
    try {
        const latestBlock = await provider.getBlockNumber();
        status.latestBlock = latestBlock;
        await upsertStandardPools();
        status.indexedThroughBlock = await indexV4Initializations(latestBlock);
        const pools = await PoolRadarPool.findAll();
        for (const pool of pools) {
            await indexPoolSwaps(pool, latestBlock);
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        status.phase = "aggregating";
        await Promise.all(pools.map(refreshPoolMetrics));
        status.metricsUpdatedAt = new Date().toISOString();
        status.lastSuccessfulUpdate = status.metricsUpdatedAt;
        status.phase = status.indexedThroughBlock >= latestBlock ? "live" : "backfilling";
        status.retryAt = null;
    } catch (error) {
        const rateLimited = /429|rate.?limit/i.test(error?.message || "");
        status.phase = rateLimited ? "rate-limited" : "error";
        status.error = error.message;
        status.retryAt = rateLimited ? new Date(Date.now() + 65_000).toISOString() : null;
        console.error("Pool Radar indexing failed:", error);
    } finally {
        status.running = false;
    }
};

let timer;
export const startPoolRadarIndexer = () => {
    if (timer) return;
    void runCycle();
    timer = setInterval(() => void runCycle(), config.intervalMs);
};

export const triggerPoolRadarIndex = async () => {
    void runCycle();
    return getPoolRadarStatus();
};

export const getPoolRadarStatus = () => ({ ...status, chainId: config.chainId, explorerUrl: config.explorerUrl });

export const getPoolRadarPools = async () => {
    const pools = await PoolRadarPool.findAll({ order: [["updatedAt", "DESC"]] });
    return pools.map((pool) => ({ ...pool.toJSON(), confidence: pool.metrics?.lastSwap ? "observed" : "partial-history" }));
};
