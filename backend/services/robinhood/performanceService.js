import { fetchRobinhoodAccount, fetchRobinhoodWalletLedger } from "./blockscoutClient.js";
import { calculateRobinhoodPerformance } from "./performanceAccounting.js";
import {
    HISTORICAL_GMGN_AUDIT_ADDRESSES,
    getHistoricalAuditStatus,
    loadCompletedHistoricalAuditLedgers,
} from "./historicalAuditService.js";
import { FUEL_CONTRACT, getProtocolPositionAssets, getProtocolPositionValuation } from "../valuationService.js";
import WalletModel from "../../models/WalletModel.js";
import sequelize from "../../sequelize.js";
import { QueryTypes } from "sequelize";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// Funding changes whenever the wallet bridges or receives funds. Keep serving
// the persistent result instantly, but refresh it in the background once it is
// more than a few minutes old so active trading sessions do not show yesterday's
// cash-flow totals.
const CACHE_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_DIRECTORY = process.env.ROBINHOOD_CACHE_DIRECTORY || path.join(process.cwd(), ".cache");
const cacheByWallet = new Map();
const refreshByWallet = new Map();
const refreshErrorByWallet = new Map();
// This is an accounting group, not a naming convention. Wallet tags are
// intentionally editable in Settings, so identifying the group by tag would
// split the ledger when a wallet is renamed.
const configuredAddresses = (value) => new Set(String(value || "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => /^0x[a-f0-9]{40}$/.test(address)));
const PERFORMANCE_WALLET_ADDRESSES = configuredAddresses(process.env.ROBINHOOD_PERFORMANCE_WALLETS);
// Kept only to migrate the already verified MM + Degen snapshot when a new
// wallet joins the accounting group. This avoids turning an internal transfer
// into a fake withdrawal while the explorer indexes the new wallet.
const LEGACY_PERFORMANCE_WALLET_ADDRESSES = configuredAddresses(process.env.ROBINHOOD_LEGACY_PERFORMANCE_WALLETS);
const CREATOR_PROJECT_CONTRACTS = new Set([FUEL_CONTRACT]);
const CASHCAT_CONTRACT = "0x020bfc650a365f8bb26819deaabf3e21291018b4";

const cacheFileFor = (cacheKey) => path.join(CACHE_DIRECTORY, `robinhood-${cacheKey}.json`);

const readPersistentCache = async (cacheKey) => {
    try {
        const cached = JSON.parse(await readFile(cacheFileFor(cacheKey), "utf8"));
        if (!cached?.savedAt || !cached?.value || Date.now() - cached.savedAt > MAX_STALE_MS) return null;
        cacheByWallet.set(cacheKey, cached);
        return cached;
    } catch (error) {
        if (error?.code !== "ENOENT") console.warn("Robinhood cache read failed:", error.message);
        return null;
    }
};

const writePersistentCache = async (cacheKey, cached) => {
    try {
        await mkdir(CACHE_DIRECTORY, { recursive: true });
        const target = cacheFileFor(cacheKey);
        const temporary = `${target}.tmp`;
        await writeFile(temporary, JSON.stringify(cached), "utf8");
        await rename(temporary, target);
    } catch (error) {
        console.warn("Robinhood cache write failed:", error.message);
    }
};

const findPerformanceWallets = async (userId) => {
    const wallets = await WalletModel.findAll({
        where: { user_id: userId },
        attributes: ["id", "wallet"],
        order: [["id", "ASC"]],
    });
    const performanceWallets = PERFORMANCE_WALLET_ADDRESSES.size
        ? wallets.filter((wallet) => PERFORMANCE_WALLET_ADDRESSES.has(String(wallet.wallet || "").toLowerCase()))
        : wallets;

    if (!performanceWallets.length) {
        throw new Error("No Robinhood performance wallet is configured");
    }

    return performanceWallets;
};

const findCreatorProjectWallets = async (userId) => {
    const wallets = await WalletModel.findAll({
        where: { user_id: userId },
        attributes: ["id", "wallet", "tag", "chain"],
        order: [["id", "ASC"]],
    });
    // The prior mutable “GMGN Lab” group made inventory and ledger scopes
    // disagree, and it caused unnecessary explorer requests. The creator view
    // now shares the explicit MM + 🐇 Degen accounting scope until a dedicated
    // creator-wallet configuration exists.
    return PERFORMANCE_WALLET_ADDRESSES.size
        ? wallets.filter((wallet) => PERFORMANCE_WALLET_ADDRESSES.has(String(wallet.wallet || "").toLowerCase()))
        : wallets;
};

const getDatabaseCurrentState = async ({ walletIds, userId }) => {
    const rows = await sequelize.query(
        `
          SELECT wt.wallet_id, w.tag AS wallet_tag, t.symbol, t.name, t.contract_address, t.price, t.logo_path, wt.amount, wt.usd_value
          FROM wallets_tokens wt
          JOIN tokens t ON t.id = wt.token_id
          JOIN wallets w ON w.id = wt.wallet_id
          WHERE wt.wallet_id IN (:walletIds)
            AND wt.user_id = :userId
            AND t.chain_id = 'hood'
          ORDER BY wt.usd_value DESC
        `,
        { replacements: { walletIds, userId }, type: QueryTypes.SELECT }
    );
    const holdingsByContract = new Map();
    const creatorProject = {
        walletFuelAmount: 0,
        walletFuelValueUsd: null,
        fuelPriceUsd: 0,
        lpFuelAmount: 0,
        lpPairedValueUsd: null,
        lpEstimatedValueUsd: null,
        liquidityPositions: [],
        pricing: {
            method: "unavailable",
            confidence: "unavailable",
            source: "no usable FUEL quote",
        },
    };
    for (const row of rows) {
        const contract = String(row.contract_address || "").toLowerCase();
        const key = contract || `${row.symbol}-${row.name}`;
        if (CREATOR_PROJECT_CONTRACTS.has(contract)) {
            const amount = Number(row.amount || 0);
            const usdValue = Number(row.usd_value || 0);
            creatorProject.walletFuelAmount += amount;
            // The legacy tokens.price column has only 8 decimal places and can
            // round micro-priced FUEL to zero. wallets_tokens.usd_value keeps
            // the provider valuation, so derive the unit quote from it before
            // declaring the asset unpriced.
            const directPrice = Number(row.price || 0) || (amount > 0 && usdValue > 0 ? usdValue / amount : 0);
            if (directPrice > 0) {
                creatorProject.fuelPriceUsd = directPrice;
                creatorProject.pricing = {
                    method: "direct",
                    confidence: "direct",
                    source: "stored provider quote",
                };
            }
            continue;
        }
        const existing = holdingsByContract.get(key) || {
            contract,
            symbol: row.symbol,
            name: row.name,
            logoPath: row.logo_path || null,
            amount: 0,
            price: Number(row.price || 0),
            usdValue: 0,
            wallets: [],
        };
        existing.amount += Number(row.amount || 0);
        existing.usdValue += Number(row.usd_value || 0);
        const wallet = existing.wallets.find((item) => item.id === Number(row.wallet_id));
        if (wallet) {
            wallet.amount += Number(row.amount || 0);
            wallet.usdValue += Number(row.usd_value || 0);
        } else {
            existing.wallets.push({
                id: Number(row.wallet_id),
                tag: row.wallet_tag || "Tracked wallet",
                amount: Number(row.amount || 0),
                usdValue: Number(row.usd_value || 0),
            });
        }
        if (Number(row.price || 0) > 0) existing.price = Number(row.price);
        holdingsByContract.set(key, existing);
    }
    const holdings = [...holdingsByContract.values()];
    const eth = holdings.find((row) => String(row.symbol).toUpperCase() === "ETH");
    const ethAmount = Number(eth?.amount || 0);
    const protocolRows = await sequelize.query(
        `SELECT wp.wallet_id, w.wallet AS wallet_address, w.tag AS wallet_tag, p.name AS protocol_name, p.chain_id, wp.portfolio_item_list
         FROM wallets_protocols wp
         JOIN wallets w ON w.id = wp.wallet_id
         JOIN protocols p ON p.id = wp.protocol_id
         WHERE wp.wallet_id IN (:walletIds)
           AND wp.user_id = :userId
           AND p.chain_id = 'hood'`,
        { replacements: { walletIds, userId }, type: QueryTypes.SELECT }
    );
    const protocolPositions = [];
    let lpEstimatedValueUsd = 0;
    let lpPairedValueUsd = 0;
    let hasPricedLiquidity = false;
    for (const row of protocolRows) for (const [index, position] of (row.portfolio_item_list || []).entries()) {
        const assets = getProtocolPositionAssets(position);
        const valuation = getProtocolPositionValuation(position);
        const valueUsd = Number(valuation.usdValue || 0);
        const isLiquidity = /liquidity|\blp\b|uniswap/i.test(`${row.protocol_name || ""} ${position?.name || ""}`);
        if (valueUsd >= 1) {
            protocolPositions.push({
                id: `${row.wallet_id}-${row.protocol_name}-${index}`,
                positionId: position?.position_index == null ? null : String(position.position_index),
                walletAddress: String(row.wallet_address || "").toLowerCase(),
                walletTag: row.wallet_tag || "Tracked wallet",
                protocol: row.protocol_name || "Protocol",
                chain: row.chain_id || "hood",
                name: position?.name || "Protocol position",
                kind: isLiquidity ? "LP" : "Protocol",
                currentValueUsd: valueUsd,
                pricing: valuation.pricing,
                assets: assets.map((asset) => ({
                    contract: String(asset?.id || asset?.address || "").toLowerCase(),
                    symbol: asset?.symbol || asset?.name || "Unknown",
                    name: asset?.name || asset?.symbol || "Unknown asset",
                    amount: Number(asset?.amount || 0),
                    price: Number(asset?.price || 0),
                    usdValue: Number(asset?.amount || 0) * Number(asset?.price || 0),
                    logoPath: asset?.logo_url || asset?.logo_path || asset?.icon_url || null,
                })),
                range: null,
                feesEarnedUsd: null,
                initialDepositUsd: null,
            });
        }
        const fuel = assets.find((asset) => CREATOR_PROJECT_CONTRACTS.has(String(asset?.id || "").toLowerCase()));
        if (!fuel) continue;

        const fuelAmount = Number(fuel.amount || 0);
        const impliedFuelPriceUsd = Number(
            valuation.pricing.inferredAssetPrices?.find((entry) => entry.contract === FUEL_CONTRACT)?.priceUsd || 0
        );
        const pairedValueUsd = valuation.pricing.method === "pool-implied"
            ? Number(valuation.usdValue || 0) / 2
            : assets
                .filter((asset) => asset !== fuel)
                .reduce((sum, asset) => sum + Number(asset.amount || 0) * Number(asset.price || 0), 0);
        creatorProject.lpFuelAmount += fuelAmount;
        creatorProject.liquidityPositions.push({
            name: position?.name || "Liquidity position",
            fuelAmount,
            pairedValueUsd: pairedValueUsd || null,
            estimatedValueUsd: Number(valuation.usdValue || 0) || null,
            pricing: valuation.pricing,
        });
        if (Number(valuation.usdValue || 0) > 0) {
            hasPricedLiquidity = true;
            lpEstimatedValueUsd += Number(valuation.usdValue);
            lpPairedValueUsd += pairedValueUsd;
        }
        if (creatorProject.fuelPriceUsd <= 0 && impliedFuelPriceUsd > 0) {
            creatorProject.fuelPriceUsd = impliedFuelPriceUsd;
            creatorProject.pricing = {
                method: "pool-implied",
                confidence: "estimated",
                source: valuation.pricing.source,
            };
        }
    }
    if (creatorProject.fuelPriceUsd > 0) {
        creatorProject.walletFuelValueUsd = creatorProject.walletFuelAmount * creatorProject.fuelPriceUsd;
    }
    creatorProject.lpPairedValueUsd = hasPricedLiquidity ? lpPairedValueUsd : null;
    creatorProject.lpEstimatedValueUsd = hasPricedLiquidity ? lpEstimatedValueUsd : null;
    return {
        account: {
            coin_balance: BigInt(Math.max(0, Math.round(ethAmount * 1e18))).toString(),
            exchange_rate: Number(eth?.price || 0),
        },
        holdings,
        protocolPositions,
        creatorProject,
    };
};

const decorateCreatorProject = (creatorProject, wallets, historicalAudit = null) => {
    const scopeWallets = wallets.map((wallet) => ({
        id: wallet.id,
        address: String(wallet.wallet || "").toLowerCase(),
        label: wallet.tag || "Tracked wallet",
    }));
    const hasWalletFuel = Number(creatorProject.walletFuelAmount || 0) > 0;
    const hasLiquidity = Number(creatorProject.lpFuelAmount || 0) > 0;
    const walletEstimate = creatorProject.walletFuelValueUsd == null ? null : Number(creatorProject.walletFuelValueUsd);
    const liquidityEstimate = creatorProject.lpEstimatedValueUsd == null ? null : Number(creatorProject.lpEstimatedValueUsd);
    const unavailableEstimate = (hasWalletFuel && walletEstimate == null) || (hasLiquidity && liquidityEstimate == null);

    return {
        ...creatorProject,
        scope: {
            accountingWallets: scopeWallets,
            inventoryWallets: scopeWallets,
            scopesMatch: true,
            // A compact, address-free description of the retired GMGN audit
            // scope. Live inventory remains the two explicit tracked wallets.
            historicalAudit: historicalAudit ? {
                source: historicalAudit.source,
                status: historicalAudit.status,
                walletCount: historicalAudit.walletCount,
                completedWalletCount: historicalAudit.completedWalletCount,
                failedWalletCount: historicalAudit.failedWalletCount,
                includedInAccounting: historicalAudit.includedInAccounting,
                inventoryIncluded: false,
                automaticRefresh: false,
            } : null,
        },
        inventory: {
            walletFuel: {
                amount: Number(creatorProject.walletFuelAmount || 0),
                estimatedValueUsd: walletEstimate,
                pricing: creatorProject.pricing,
            },
            liquidity: {
                fuelAmount: Number(creatorProject.lpFuelAmount || 0),
                pairedAssetValueUsd: creatorProject.lpPairedValueUsd == null ? null : Number(creatorProject.lpPairedValueUsd),
                fullPositionEstimatedUsd: liquidityEstimate,
                positions: creatorProject.liquidityPositions || [],
            },
            combinedEstimatedValueUsd: unavailableEstimate
                ? null
                : Number(walletEstimate || 0) + Number(liquidityEstimate || 0),
        },
        inventoryAsOf: new Date().toISOString(),
    };
};

const applyLiveNativeBalance = async (currentState, addresses) => {
    try {
        const accounts = await Promise.all(addresses.map((address) => fetchRobinhoodAccount(address)));
        const coinBalance = accounts.reduce((sum, account) => sum + BigInt(account?.coin_balance || 0), 0n);
        const ethUsd = accounts.reduce((sum, account) => sum + Number(account?.exchange_rate || 0), 0) / Math.max(1, accounts.length);
        const amount = Number(coinBalance) / 1e18;
        const holdings = currentState.holdings.map((holding) =>
            String(holding.symbol).toUpperCase() === "ETH"
                ? { ...holding, amount, price: ethUsd || holding.price, usdValue: amount * (ethUsd || holding.price) }
                : holding
        );
        if (!holdings.some((holding) => String(holding.symbol).toUpperCase() === "ETH")) {
            holdings.push({ contract: "", symbol: "ETH", name: "Ether", amount, price: ethUsd, usdValue: amount * ethUsd });
        }
        return {
            ...currentState,
            account: { coin_balance: coinBalance.toString(), exchange_rate: ethUsd || currentState.account.exchange_rate },
            holdings,
        };
    } catch (error) {
        console.warn("Robinhood live balance unavailable; using stored value:", error.message);
        return currentState;
    }
};

const uniqueBy = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];

const combineLedgers = (ledgers, account) => ({
    account,
    transactions: uniqueBy(ledgers.flatMap((ledger) => ledger.transactions), (item) => item.hash),
    internalTransactions: uniqueBy(
        ledgers.flatMap((ledger) => ledger.internalTransactions),
        (item) => `${item.transaction_hash}-${item.from?.hash}-${item.to?.hash}-${item.value}`
    ),
    tokenTransfers: uniqueBy(
        ledgers.flatMap((ledger) => ledger.tokenTransfers),
        (item) => `${item.transaction_hash}-${item.log_index ?? ""}-${item.from?.hash}-${item.to?.hash}-${item.token?.address_hash}-${item.total?.value}`
    ),
    tokenBalances: [],
    internalTransactionsAvailable: ledgers.every((ledger) => ledger.internalTransactionsAvailable),
});

const lower = (value) => String(value || "").toLowerCase();

const summarizeTokenPnl = (tokenPnl = []) => {
    const summaryPnl = tokenPnl.filter((item) => !item.excludeFromSummary);
    const priced = summaryPnl.filter((item) => item.pricingStatus === "Priced");
    const realizedPnlEth = summaryPnl.reduce((sum, item) => sum + Number(item.realizedPnlEth || 0), 0);
    const unrealizedPnlEth = priced.reduce((sum, item) => sum + Number(item.unrealizedPnlEth || 0), 0);
    return {
        realizedPnlEth,
        realizedPnlUsd: summaryPnl.reduce((sum, item) => sum + Number(item.realizedPnlUsd || 0), 0),
        currentValueEth: priced.reduce((sum, item) => sum + Number(item.currentValueEth || 0), 0),
        currentValueUsd: priced.reduce((sum, item) => sum + Number(item.currentValueUsd || 0), 0),
        unrealizedPnlEth,
        unrealizedPnlUsd: priced.reduce((sum, item) => sum + Number(item.unrealizedPnlUsd || 0), 0),
        totalPnlEth: realizedPnlEth + unrealizedPnlEth,
        totalPnlUsd: summaryPnl.reduce((sum, item) => sum + Number(item.totalPnlUsd || 0), 0),
        purchasedContracts: summaryPnl.length,
        pricedContracts: priced.length,
        partial: priced.length !== summaryPnl.length,
    };
};

const withDataFreshness = (value, {
    source,
    savedAt = Date.now(),
    lastError = null,
    isIndexing = false,
    indexingMessage = null,
} = {}) => ({
    ...value,
    dataFreshness: {
        source,
        asOf: new Date(savedAt).toISOString(),
        stale: source !== "live",
        lastError,
        isIndexing,
        indexingMessage,
    },
});

const applyDatabaseCurrentState = (value, currentState) => {
    const ethUsd = Number(currentState.account.exchange_rate || value.valuation?.ethUsd || 0);
    const fuelInventory = currentState.creatorProject?.inventory?.walletFuel;
    const fuelAmount = Number(fuelInventory?.amount || currentState.creatorProject?.walletFuelAmount || 0);
    let fuelValueUsd = fuelInventory?.estimatedValueUsd ?? currentState.creatorProject?.walletFuelValueUsd ?? null;
    let fuelPriceUsd = Number(fuelInventory?.pricing?.priceUsd || currentState.creatorProject?.fuelPriceUsd || 0);
    const performanceHoldings = [...currentState.holdings];
    if (fuelAmount > 0) {
        performanceHoldings.push({
            contract: FUEL_CONTRACT,
            symbol: "FUEL",
            name: "CashCat Fuel · developer inventory",
            amount: fuelAmount,
            price: fuelPriceUsd,
            usdValue: fuelValueUsd == null ? 0 : Number(fuelValueUsd),
            classification: "developer-inventory",
            estimated: true,
        });
    }
    const holdingByContract = new Map(
        performanceHoldings
            .filter((holding) => holding.contract)
            .map((holding) => [holding.contract, holding])
    );
    if (fuelPriceUsd <= 0) {
        const cashcatPriceUsd = Number(holdingByContract.get(CASHCAT_CONTRACT)?.price || 0);
        const latestLp = (value.tokenPnl || [])
            .filter((row) => row.classification === "developer-lp" && row.lpAccounting?.lastOperation)
            .sort((left, right) => String(right.lpAccounting.lastTimestamp).localeCompare(String(left.lpAccounting.lastTimestamp)))[0];
        const flow = latestLp?.lpAccounting?.lastOperation?.returned?.fuel > 0
            ? latestLp.lpAccounting.lastOperation.returned
            : latestLp?.lpAccounting?.lastOperation?.deposited;
        if (cashcatPriceUsd > 0 && Number(flow?.fuel || 0) > 0 && Number(flow?.cashcat || 0) > 0) {
            fuelPriceUsd = cashcatPriceUsd * Number(flow.cashcat) / Number(flow.fuel);
            fuelValueUsd = fuelAmount * fuelPriceUsd;
            currentState.creatorProject.fuelPriceUsd = fuelPriceUsd;
            currentState.creatorProject.walletFuelValueUsd = fuelValueUsd;
            currentState.creatorProject.pricing = {
                method: "lp-exit-implied",
                confidence: "estimated",
                source: `latest CASHCAT/FUEL LP operation #${latestLp.lpAccounting.positionId}`,
            };
            if (fuelInventory) {
                fuelInventory.estimatedValueUsd = fuelValueUsd;
                fuelInventory.pricing = currentState.creatorProject.pricing;
            }
        }
    }
    const tokenPnl = (value.tokenPnl || []).filter(
        (row) => !CREATOR_PROJECT_CONTRACTS.has(lower(row.contract)) || row.classification === "developer-expense"
    ).map((row) => {
        if (row.classification === "developer-lp") {
            const cashcatPriceUsd = Number(holdingByContract.get(CASHCAT_CONTRACT)?.price || 0);
            const deposited = row.lpAccounting?.deposited || {};
            const returned = row.lpAccounting?.returnedIncludingFees || {};
            const priced = cashcatPriceUsd > 0 && fuelPriceUsd > 0 && ethUsd > 0;
            const depositedUsd = Number(deposited.cashcat || 0) * cashcatPriceUsd
                + Number(deposited.fuel || 0) * fuelPriceUsd;
            const returnedUsd = Number(returned.cashcat || 0) * cashcatPriceUsd
                + Number(returned.fuel || 0) * fuelPriceUsd;
            const gasUsd = Number(row.lpAccounting?.gasEth || 0) * ethUsd;
            const totalPnlUsd = priced ? returnedUsd - depositedUsd - gasUsd : null;
            return {
                ...row,
                logoPath: row.logoPath || null,
                ethInvested: priced ? depositedUsd / ethUsd : 0,
                ethReceived: priced ? returnedUsd / ethUsd : 0,
                realizedPnlEth: totalPnlUsd == null ? 0 : totalPnlUsd / ethUsd,
                realizedPnlUsd: totalPnlUsd ?? 0,
                totalPnlEth: totalPnlUsd == null ? null : totalPnlUsd / ethUsd,
                totalPnlUsd,
                returnPercentage: priced && depositedUsd > 0 ? totalPnlUsd / depositedUsd * 100 : null,
                pricingStatus: priced ? "Priced" : "Unpriced",
                lpAccounting: {
                    ...row.lpAccounting,
                    depositedValueUsdAtExitPrices: priced ? depositedUsd : null,
                    returnedValueUsdAtExitPrices: priced ? returnedUsd : null,
                    gasUsd: priced ? gasUsd : null,
                    pnlIncludingFeesAndIlUsd: totalPnlUsd,
                },
            };
        }
        if (row.classification === "developer-expense") {
            const currentValueUsd = fuelValueUsd == null || fuelPriceUsd <= 0 ? null : Number(fuelValueUsd);
            const currentValueEth = currentValueUsd == null || ethUsd <= 0 ? null : currentValueUsd / ethUsd;
            const netCostEth = Number(
                row.developerCost?.netCostEth
                ?? (Number(row.ethInvested || 0) - Number(row.ethReceived || 0))
            );
            const remainingCostBasis = Math.max(0, netCostEth);
            const realizedPnlEth = netCostEth < 0 ? -netCostEth : 0;
            const unrealizedPnlEth = currentValueEth == null ? null : currentValueEth - remainingCostBasis;
            const totalPnlEth = currentValueEth == null ? null : currentValueEth - netCostEth;
            return {
                ...row,
                manuallyClosed: fuelAmount <= 0,
                quantityBought: fuelAmount,
                quantitySold: fuelAmount <= 0 ? fuelAmount : 0,
                walletBalance: fuelAmount,
                attributableBalance: fuelAmount,
                currentUsdPrice: fuelPriceUsd > 0 ? fuelPriceUsd : null,
                currentValueEth,
                currentValueUsd,
                realizedPnlEth,
                realizedPnlUsd: realizedPnlEth * ethUsd,
                remainingCostBasis,
                unrealizedPnlEth,
                unrealizedPnlUsd: unrealizedPnlEth == null ? null : unrealizedPnlEth * ethUsd,
                totalPnlEth,
                totalPnlUsd: totalPnlEth == null ? null : totalPnlEth * ethUsd,
                returnPercentage:
                    totalPnlEth == null || !Number(row.ethInvested || 0)
                        ? null
                        : (totalPnlEth / Number(row.ethInvested || 0)) * 100,
                pricingStatus: currentValueUsd == null ? "Unpriced" : "Priced",
            };
        }
        const holding = holdingByContract.get(lower(row.contract));
        if (!holding) {
            const totalPnlEth =
                ethUsd > 0
                    ? Number(row.realizedPnlEth || 0) - Number(row.remainingCostBasis || 0)
                    : null;
            return {
                ...row,
                walletBalance: 0,
                attributableBalance: 0,
                currentUsdPrice: row.currentUsdPrice || null,
                currentValueEth: 0,
                currentValueUsd: 0,
                unrealizedPnlEth: ethUsd > 0 ? -Number(row.remainingCostBasis || 0) : null,
                unrealizedPnlUsd: ethUsd > 0 ? -Number(row.remainingCostBasis || 0) * ethUsd : null,
                totalPnlEth,
                totalPnlUsd: totalPnlEth == null ? null : totalPnlEth * ethUsd,
                returnPercentage:
                    totalPnlEth == null || !Number(row.ethInvested || 0)
                        ? null
                        : (totalPnlEth / Number(row.ethInvested || 0)) * 100,
                pricingStatus: "Priced",
            };
        }

        const walletBalance = Number(holding.amount || 0);
        // LP withdrawals are returned capital and have their own lifecycle
        // ledger. Never value those zero-cost quantities as token-trading P&L.
        const tradingWalletBalance = Math.max(
            0,
            walletBalance - Number(row.lpExcludedWalletQuantity || 0)
        );
        const attributableBalance = Math.min(
            tradingWalletBalance,
            Math.max(0, Number(row.inventoryQuantity || 0))
        );
        const currentUsdPrice = Number(holding.price || 0);
        const priced = currentUsdPrice > 0 && ethUsd > 0;
        const currentValueUsd = priced ? attributableBalance * currentUsdPrice : null;
        const currentValueEth = priced ? currentValueUsd / ethUsd : null;
        const unrealizedPnlEth = priced ? currentValueEth - Number(row.remainingCostBasis || 0) : null;
        const totalPnlEth = priced ? Number(row.realizedPnlEth || 0) + unrealizedPnlEth : null;
        return {
            ...row,
            logoPath: holding.logoPath || row.logoPath || null,
            walletBalance,
            attributableBalance,
            currentUsdPrice: priced ? currentUsdPrice : null,
            currentValueEth,
            currentValueUsd,
            unrealizedPnlEth,
            unrealizedPnlUsd: unrealizedPnlEth == null ? null : unrealizedPnlEth * ethUsd,
            totalPnlEth,
            totalPnlUsd: totalPnlEth == null ? null : totalPnlEth * ethUsd,
            returnPercentage:
                totalPnlEth == null || !Number(row.ethInvested || 0)
                    ? null
                    : (totalPnlEth / Number(row.ethInvested || 0)) * 100,
            pricingStatus: priced ? "Priced" : "Unpriced",
        };
    });
    const summary = summarizeTokenPnl(tokenPnl);
    const liveEthBalance = Number(currentState.account.coin_balance || 0) / 1e18;
    const expectedBalance = Number(value.reconciliation?.expectedBalance || 0);
    const reconciliationDifference = liveEthBalance - expectedBalance;
    const reconciliationToleranceEth = 0.01;
    const nativeFlowReconciliationComplete = Boolean(value.dataQuality?.internalTransactionsAvailable)
        && expectedBalance >= -reconciliationToleranceEth
        && Math.abs(reconciliationDifference) <= reconciliationToleranceEth;
    const cachedCreatorFlow = value.creatorProject?.fuelLinkedNativeFlow;
    const creatorFlow = cachedCreatorFlow
        ? {
            ...cachedCreatorFlow,
            ethUsd,
            outboundNativeUsdAtCurrentEth: Number(cachedCreatorFlow.outboundNativeEth || 0) * ethUsd,
            matchingGasUsdAtCurrentEth: Number(cachedCreatorFlow.matchingGasEth || 0) * ethUsd,
            inboundNativeUsdAtCurrentEth: Number(cachedCreatorFlow.inboundNativeEth || 0) * ethUsd,
            netNativeUsdAtCurrentEth: Number(cachedCreatorFlow.netNativeEth || 0) * ethUsd,
        }
        : null;
    const liveV4Positions = (currentState.protocolPositions || []).filter((position) =>
        /uniswap\s*v4/i.test(String(position.protocol || "")) && position.kind === "LP"
    );
    const lifecyclePositions = value.lpLifecycle?.positions || [];
    const lifecycleByWallet = new Map();
    const lifecycleById = new Map();
    for (const position of lifecyclePositions.filter((item) => item.status !== "closed")) {
        const key = String(position.wallet || "").toLowerCase();
        if (!lifecycleByWallet.has(key)) lifecycleByWallet.set(key, []);
        lifecycleByWallet.get(key).push(position);
        lifecycleById.set(String(position.positionId), position);
    }
    const lpPerformance = liveV4Positions.map((position) => {
        const matches = lifecycleByWallet.get(String(position.walletAddress || "").toLowerCase()) || [];
        // DeBank's position_index is the Uniswap v4 position NFT token id.
        // Prefer that exact durable identity; the wallet-only fallback is safe
        // solely where the wallet owns one active position.
        const lifecycle = lifecycleById.get(String(position.positionId))
            || (matches.length === 1 ? matches[0] : null);
        const currentValueUsd = Number(position.currentValueUsd || 0);
        const lifecycleValued = lifecycle?.valuationStatus === "valued";
        const depositsUsd = lifecycle ? Number(lifecycle.depositsUsd || 0) : null;
        const returnedUsd = lifecycle ? Number(lifecycle.returnedUsd || 0) : null;
        const gasUsd = lifecycle ? Number(lifecycle.gasUsd || 0) : null;
        const pnlUsd = lifecycle && lifecycleValued && depositsUsd != null
            ? currentValueUsd + Number(returnedUsd || 0) - depositsUsd - Number(gasUsd || 0)
            : null;
        return {
            positionId: lifecycle?.positionId || null,
            wallet: position.walletTag,
            pair: position.assets.map((asset) => asset.symbol).join(" / ") || position.name,
            currentValueUsd,
            depositsUsd,
            returnedUsd,
            gasUsd,
            pnlUsd,
            returnPercent: pnlUsd != null && depositsUsd > 0 ? pnlUsd / depositsUsd * 100 : null,
            feesEarnedUsd: null,
            impermanentLossUsd: null,
            accountingStatus: lifecycle && lifecycleValued ? "tracked" : lifecycle ? "partial" : "unmatched",
            matchConfidence: lifecycle?.matchConfidence || null,
            events: lifecycle?.events || [],
        };
    });

    return {
        ...value,
        valuation: {
            ...value.valuation,
            ethUsd,
        },
        funding: {
            ...value.funding,
            currentEthBalance: Number(currentState.account.coin_balance || 0) / 1e18,
        },
        reconciliation: {
            ...value.reconciliation,
            expectedBalance,
            currentBalance: liveEthBalance,
            difference: reconciliationDifference,
            status: nativeFlowReconciliationComplete ? "OK" : "Incomplete",
            authoritative: nativeFlowReconciliationComplete,
            incompleteReason: nativeFlowReconciliationComplete
                ? null
                : "Router and LP return legs do not fully reconcile to the combined native balance; this diagnostic is excluded from P&L.",
        },
        summary: {
            ...value.summary,
            ...summary,
            partial: summary.partial || value.dataQuality?.internalTransactionsAvailable === false,
        },
        tokenPnl,
        currentState: {
            source: "database",
            holdings: performanceHoldings,
            protocolPositions: currentState.protocolPositions || [],
        },
        lpPerformance,
        creatorProject: {
            ...value.creatorProject,
            // Holdings and LP amounts belong to the live tracked-wallet state;
            // an older ledger cache must not overwrite them with zeros.
            ...currentState.creatorProject,
            ...(creatorFlow ? { fuelLinkedNativeFlow: creatorFlow } : {}),
            // Older cache entries only had cumulative devSpendUsd. Do not
            // present that as a loss; wait for a net on-chain calculation.
            devGrossSpendUsd: value.creatorProject?.devGrossSpendEth == null
                ? null
                : Number(value.creatorProject.devGrossSpendEth) * ethUsd,
            devReturnedUsd: value.creatorProject?.devReturnedEth == null
                ? null
                : Number(value.creatorProject.devReturnedEth) * ethUsd,
            devNetSpendUsd: value.creatorProject?.devNetSpendEth == null
                ? null
                : Number(value.creatorProject.devNetSpendEth) * ethUsd,
        },
    };
};

export const getRobinhoodPerformance = async ({ userId, force = false } = {}) => {
    if (!userId) throw new Error("Authenticated user is required");

    const wallets = await findPerformanceWallets(userId);
    const creatorWallets = await findCreatorProjectWallets(userId);
    const addresses = wallets.map((wallet) => wallet.wallet.toLowerCase());
    const address = addresses[0];
    // Historical GMGN rows are read only from the database. They are fetched
    // exclusively by the explicit history-audit POST endpoint, never by a
    // dashboard view or routine wallet refresh.
    const historicalAudit = await getHistoricalAuditStatus(userId);
    const historicalLedgers = historicalAudit.includedInAccounting
        ? await loadCompletedHistoricalAuditLedgers(userId)
        : [];
    const accountingAddresses = historicalLedgers.length
        ? [...addresses, ...HISTORICAL_GMGN_AUDIT_ADDRESSES]
        : addresses;
    const storedCurrentState = await getDatabaseCurrentState({ walletIds: wallets.map((wallet) => wallet.id), userId });
    const creatorCurrentState = await getDatabaseCurrentState({ walletIds: creatorWallets.map((wallet) => wallet.id), userId });
    const currentState = await applyLiveNativeBalance(storedCurrentState, addresses);
    currentState.creatorProject = decorateCreatorProject(creatorCurrentState.creatorProject, creatorWallets, historicalAudit);
    const cacheKey = addresses.slice().sort().join("-");
    const cached = cacheByWallet.get(cacheKey) || await readPersistentCache(cacheKey);
    const legacyAddresses = addresses.filter((walletAddress) => LEGACY_PERFORMANCE_WALLET_ADDRESSES.has(walletAddress));
    const legacyCacheKey = legacyAddresses.slice().sort().join("-");
    const legacyCached = !cached && legacyAddresses.length && legacyAddresses.length < addresses.length
        ? cacheByWallet.get(legacyCacheKey) || await readPersistentCache(legacyCacheKey)
        : null;
    // A legacy verified ledger already contains the outbound half of a MM →
    // RED 25 move. Calculating it against the expanded wallet group correctly
    // keeps that move internal before RED 25's own explorer history arrives.
    const activeCached = cached || legacyCached;
    const publicHistoricalAudit = {
        ...historicalAudit,
        // This expresses coverage, not asset ownership: inventory is always
        // limited to MM + 🐇 Degen above.
        accountingIncorporated: historicalLedgers.length > 0,
    };
    const withHistoricalAudit = (value) => ({ ...value, historicalAudit: publicHistoricalAudit });

    const calculateFromLedgers = (liveLedgers) => withHistoricalAudit(applyDatabaseCurrentState(
        calculateRobinhoodPerformance({
            address,
            addresses: accountingAddresses,
            ...combineLedgers([...liveLedgers, ...historicalLedgers], currentState.account),
        }),
        currentState
    ));
    // New cache entries retain the two live raw ledgers. That lets a completed
    // immutable historical bundle be incorporated locally on later views,
    // without another provider request. Legacy cache files simply keep their
    // last verified result until the next explicit Robinhood refresh.
    const materializeCachedValue = () => Array.isArray(activeCached?.liveLedgers)
        ? calculateFromLedgers(activeCached.liveLedgers)
        : withHistoricalAudit(applyDatabaseCurrentState(activeCached.value, currentState));

    if (!force && activeCached && Date.now() - activeCached.savedAt < CACHE_MS) {
        return withDataFreshness(
            materializeCachedValue(),
            {
                source: "cache",
                savedAt: activeCached.savedAt,
                isIndexing: refreshByWallet.has(cacheKey),
                indexingMessage: refreshByWallet.has(cacheKey) ? "Indexing Robinhood wallet history in the background." : null,
            }
        );
    }

    const refresh = () => {
        if (refreshByWallet.has(cacheKey)) return refreshByWallet.get(cacheKey);
        // When RED 25 was added, reuse the complete MM + Degen snapshot and
        // request only the new wallet. The existing snapshot is still enough
        // to classify MM → RED 25 as an internal transfer.
        const reusedLedgers = !cached && Array.isArray(legacyCached?.liveLedgers)
            ? legacyCached.liveLedgers
            : [];
        const addressesToFetch = reusedLedgers.length
            ? addresses.filter((walletAddress) => !LEGACY_PERFORMANCE_WALLET_ADDRESSES.has(walletAddress))
            : addresses;
        const promise = addressesToFetch.reduce(
            (ledgerPromise, walletAddress) => ledgerPromise.then(async (ledgers) => [
                ...ledgers,
                await fetchRobinhoodWalletLedger(walletAddress, {
                accountOverride: { coin_balance: "0", exchange_rate: currentState.account.exchange_rate },
                }),
            ]),
            Promise.resolve(reusedLedgers)
        )
            .then((ledgers) => ({ ledgers, value: calculateFromLedgers(ledgers) }))
            .then(async (value) => {
                const nextCache = { savedAt: Date.now(), value: value.value, liveLedgers: value.ledgers };
                cacheByWallet.set(cacheKey, nextCache);
                await writePersistentCache(cacheKey, nextCache);
                refreshErrorByWallet.delete(cacheKey);
                return value.value;
            })
            .catch((error) => {
                refreshErrorByWallet.set(cacheKey, { at: Date.now(), message: error.message });
                throw error;
            })
            .finally(() => refreshByWallet.delete(cacheKey));
        refreshByWallet.set(cacheKey, promise);
        return promise;
    };

    if (activeCached) {
        const previousError = refreshErrorByWallet.get(cacheKey);
        const errorIsCoolingDown = previousError && Date.now() - previousError.at < CACHE_MS;
        const shouldRefresh = force || (!errorIsCoolingDown && Date.now() - activeCached.savedAt >= CACHE_MS);
        if (shouldRefresh && !refreshByWallet.has(cacheKey)) {
            // Keep the verified snapshot visible while Blockscout is scanned.
            // The client polls this endpoint until the new cache is committed.
            void refresh().catch((error) => {
                console.warn("Robinhood background refresh failed; retaining verified snapshot:", error.message);
            });
        }
        const isIndexing = refreshByWallet.has(cacheKey);
        return withDataFreshness(
            materializeCachedValue(),
            {
                source: legacyCached ? "stale-cache" : "cache",
                savedAt: activeCached.savedAt,
                isIndexing,
                indexingMessage: isIndexing ? "Indexing Robinhood wallet history in the background." : null,
                lastError: !isIndexing && previousError
                    ? "The latest explorer refresh failed; the last verified snapshot is still shown."
                    : null,
            }
        );
    }

    try {
        return withDataFreshness(await refresh(), { source: "live" });
    } catch (error) {
        // A manual refresh should never leave the dashboard indefinitely
        // loading because the public explorer has rate-limited a large ledger.
        if (activeCached) {
            console.warn("Robinhood refresh rate-limited; returning last verified snapshot:", error.message);
            return withDataFreshness(
                materializeCachedValue(),
                { source: "stale-cache", savedAt: activeCached.savedAt, lastError: "Explorer refresh was rate-limited; showing the last verified ledger." }
            );
        }
        throw error;
    }
};
