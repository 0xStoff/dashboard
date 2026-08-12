import test from "node:test";
import assert from "node:assert/strict";
import { calculateRobinhoodPerformance } from "../services/robinhood/performanceAccounting.js";

const WALLET = "0x1111111111111111111111111111111111111111";
const POSITION_MANAGER = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const V3_POSITION_MANAGER = "0x73991a25c818bf1f1128deaab1492d45638de0d3";
const USDG = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
const CASHCAT = "0x020bfc650a365f8bb26819deaabf3e21291018b4";
const ZERO = "0x0000000000000000000000000000000000000000";

const address = (hash) => ({ hash });
const erc20 = ({ hash, from, to, quantity }) => ({
    transaction_hash: hash,
    token_type: "ERC-20",
    from: address(from),
    to: address(to),
    token: { address_hash: USDG, symbol: "USDG", name: "Global Dollar", decimals: "6", exchange_rate: "1" },
    total: { value: String(Math.round(quantity * 1e6)), decimals: "6" },
});
const tokenTransfer = ({ hash, from, to, quantity, contract, symbol, decimals = 18, exchangeRate }) => ({
    transaction_hash: hash,
    token_type: "ERC-20",
    from: address(from),
    to: address(to),
    token: { address_hash: contract, symbol, name: symbol, decimals: String(decimals), ...(exchangeRate == null ? {} : { exchange_rate: String(exchangeRate) }) },
    total: { value: String(BigInt(Math.round(quantity * 10 ** Math.min(decimals, 8))) * 10n ** BigInt(Math.max(0, decimals - 8))), decimals: String(decimals) },
});
const nft = ({ hash, from, to, id }) => ({
    transaction_hash: hash,
    token_type: "ERC-721",
    from: address(from),
    to: address(to),
    token: { address_hash: POSITION_MANAGER, symbol: "UNI-V4-POSM" },
    total: { value: "1", token_id: String(id) },
});

test("v4 mint, withdrawal, and collected value stay out of token P&L", () => {
    const mintHash = "0xaaa";
    const closeHash = "0xbbb";
    const result = calculateRobinhoodPerformance({
        address: WALLET,
        addresses: [WALLET],
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: mintHash, from: address(WALLET), to: address(POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T10:00:00Z", value: "0", fee: { value: "1000000000000000" } },
            { hash: closeHash, from: address(WALLET), to: address(POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T11:00:00Z", value: "0", fee: { value: "1000000000000000" } },
        ],
        internalTransactions: [],
        tokenTransfers: [
            erc20({ hash: mintHash, from: WALLET, to: POSITION_MANAGER, quantity: 1000 }),
            nft({ hash: mintHash, from: ZERO, to: WALLET, id: 42 }),
            erc20({ hash: closeHash, from: POSITION_MANAGER, to: WALLET, quantity: 1050 }),
            nft({ hash: closeHash, from: WALLET, to: ZERO, id: 42 }),
        ],
        tokenBalances: [{ token: { address_hash: USDG, exchange_rate: "1" } }],
    });

    assert.equal(result.purchases.length, 0);
    assert.equal(result.sales.length, 0);
    assert.equal(result.lpLifecycle.positions.length, 1);
    assert.equal(result.lpLifecycle.positions[0].positionId, "42");
    assert.equal(result.lpLifecycle.positions[0].status, "closed");
    assert.equal(result.lpLifecycle.positions[0].depositsUsd, 1000);
    assert.equal(result.lpLifecycle.positions[0].returnedUsd, 1050);
    assert.equal(result.lpLifecycle.positions[0].events[0].nativeDepositEth, 0);
    assert.equal(result.lpLifecycle.positions[0].events[1].nativeReturnedEth, 0);
    assert.deepEqual(result.lpLifecycle.positions[0].events.map((event) => event.type), ["mint", "close"]);

    const usdg = result.tokenPnl.find((row) => row.contract === USDG);
    assert.ok(usdg);
    assert.equal(usdg.attributableBalance, 0);
    assert.equal(usdg.currentValueUsd, 0);
    assert.equal(usdg.totalPnlUsd, 0);
    assert.equal(usdg.lpExcludedWalletQuantity, 1050);
});

test("USDG LP basis uses its ETH acquisition cost and calldata assigns multi-position updates", () => {
    const buyHash = "0xbuy";
    const mint42 = "0xmint42";
    const mint43 = "0xmint43";
    const update42 = "0xupdate42";
    const id42Word = BigInt(42).toString(16).padStart(64, "0");
    const transferWithoutPrice = (args) => {
        const transfer = erc20(args);
        delete transfer.token.exchange_rate;
        return transfer;
    };
    const result = calculateRobinhoodPerformance({
        address: WALLET,
        addresses: [WALLET],
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: buyHash, from: address(WALLET), to: address("0x2222222222222222222222222222222222222222"), status: "ok", timestamp: "2026-08-10T09:00:00Z", value: "500000000000000000", fee: { value: "0" } },
            { hash: mint42, from: address(WALLET), to: address(POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T10:00:00Z", value: "0", fee: { value: "0" } },
            { hash: mint43, from: address(WALLET), to: address(POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T10:01:00Z", value: "0", fee: { value: "0" } },
            { hash: update42, from: address(WALLET), to: address(POSITION_MANAGER), raw_input: `0x${id42Word}`, status: "ok", timestamp: "2026-08-10T10:02:00Z", value: "0", fee: { value: "0" } },
        ],
        internalTransactions: [],
        tokenTransfers: [
            transferWithoutPrice({ hash: buyHash, from: "0x2222222222222222222222222222222222222222", to: WALLET, quantity: 990 }),
            transferWithoutPrice({ hash: mint42, from: WALLET, to: POSITION_MANAGER, quantity: 990 }),
            nft({ hash: mint42, from: ZERO, to: WALLET, id: 42 }),
            nft({ hash: mint43, from: ZERO, to: WALLET, id: 43 }),
            transferWithoutPrice({ hash: update42, from: POSITION_MANAGER, to: WALLET, quantity: 10 }),
        ],
        tokenBalances: [],
    });

    const position42 = result.lpLifecycle.positions.find((position) => position.positionId === "42");
    assert.equal(position42.depositsUsd, 1000);
    assert.equal(position42.returnedUsd, 10);
    assert.equal(position42.events.at(-1).matchConfidence, undefined);
    assert.equal(position42.matchConfidence, "calldata-position-id");
    assert.equal(result.lpLifecycle.unmatchedMovements.length, 0);
});

test("Uniswap v3 deposits remain LP capital instead of token sales or losses", () => {
    const index = "0x56910d4409f3a0c78c64dd8d0545ff0705389870";
    const buyHash = "0xv3buy";
    const mintHash = "0xv3mint";
    const indexTransfer = ({ hash, from, to, quantity }) => ({
        transaction_hash: hash,
        token_type: "ERC-20",
        from: address(from),
        to: address(to),
        token: { address_hash: index, symbol: "INDEX", name: "The Index", decimals: "18", exchange_rate: "0.01" },
        total: { value: String(BigInt(quantity) * 10n ** 18n), decimals: "18" },
    });
    const result = calculateRobinhoodPerformance({
        address: WALLET,
        addresses: [WALLET],
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: buyHash, from: address(WALLET), to: address("0x2222222222222222222222222222222222222222"), status: "ok", timestamp: "2026-08-10T09:00:00Z", value: "50000000000000000", fee: { value: "0" } },
            { hash: mintHash, from: address(WALLET), to: address(V3_POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T10:00:00Z", value: "20000000000000000", fee: { value: "0" } },
        ],
        internalTransactions: [],
        tokenTransfers: [
            indexTransfer({ hash: buyHash, from: "0x2222222222222222222222222222222222222222", to: WALLET, quantity: 100 }),
            indexTransfer({ hash: mintHash, from: WALLET, to: "0x3333333333333333333333333333333333333333", quantity: 100 }),
        ],
        tokenBalances: [],
    });

    const row = result.tokenPnl.find((item) => item.contract === index);
    assert.equal(result.sales.length, 0);
    assert.equal(result.externalTokenOutflows.length, 0);
    assert.equal(row.lpDeployedQuantity, 100);
    assert.equal(row.lpDeployedCost, 0.05);
    assert.equal(row.totalPnlUsd, 0);
});

test("USDG swapped through WETH is a sale before CASHCAT purchase, not an outflow", () => {
    const usdgToWeth = "0xswap1";
    const wethToCashcat = "0xswap2";
    const result = calculateRobinhoodPerformance({
        address: WALLET,
        addresses: [WALLET],
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: usdgToWeth, from: address(WALLET), to: address("0x2222222222222222222222222222222222222222"), status: "ok", timestamp: "2026-08-10T12:00:00Z", value: "0", fee: { value: "0" } },
            { hash: wethToCashcat, from: address(WALLET), to: address("0x2222222222222222222222222222222222222222"), status: "ok", timestamp: "2026-08-10T12:01:00Z", value: "0", fee: { value: "0" } },
        ],
        internalTransactions: [],
        tokenTransfers: [
            erc20({ hash: usdgToWeth, from: WALLET, to: "0x3333333333333333333333333333333333333333", quantity: 100 }),
            tokenTransfer({ hash: usdgToWeth, from: "0x3333333333333333333333333333333333333333", to: WALLET, quantity: 0.05, contract: WETH, symbol: "WETH" }),
            tokenTransfer({ hash: wethToCashcat, from: WALLET, to: "0x3333333333333333333333333333333333333333", quantity: 0.05, contract: WETH, symbol: "WETH" }),
            tokenTransfer({ hash: wethToCashcat, from: "0x3333333333333333333333333333333333333333", to: WALLET, quantity: 1000, contract: CASHCAT, symbol: "CASHCAT", exchangeRate: 0.1 }),
        ],
        tokenBalances: [{ token: { address_hash: USDG, exchange_rate: "1" } }, { token: { address_hash: CASHCAT, exchange_rate: "0.1" } }],
    });

    assert.equal(result.externalTokenOutflows.length, 0);
    assert.equal(result.sales.find((sale) => sale.contract === USDG)?.quantitySold, 100);
    assert.equal(result.sales.find((sale) => sale.contract === USDG)?.usdReceived, 100);
    assert.equal(result.purchases.find((purchase) => purchase.contract === CASHCAT)?.usdValue, 100);
});

test("direct USDG to CASHCAT conversion transfers dollar basis", () => {
    const hash = "0xdirectswap";
    const mintHash = "0xcashcatmint";
    const result = calculateRobinhoodPerformance({
        address: WALLET,
        addresses: [WALLET],
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash, from: address(WALLET), to: address("0x2222222222222222222222222222222222222222"), status: "ok", timestamp: "2026-08-10T12:00:00Z", value: "0", fee: { value: "0" } },
            { hash: mintHash, from: address(WALLET), to: address(POSITION_MANAGER), status: "ok", timestamp: "2026-08-10T12:01:00Z", value: "0", fee: { value: "0" } },
        ],
        internalTransactions: [],
        tokenTransfers: [
            erc20({ hash, from: WALLET, to: "0x3333333333333333333333333333333333333333", quantity: 250 }),
            tokenTransfer({ hash, from: "0x3333333333333333333333333333333333333333", to: WALLET, quantity: 2500, contract: CASHCAT, symbol: "CASHCAT", exchangeRate: 0.1 }),
            tokenTransfer({ hash: mintHash, from: WALLET, to: POSITION_MANAGER, quantity: 2500, contract: CASHCAT, symbol: "CASHCAT", exchangeRate: 0.2 }),
            nft({ hash: mintHash, from: ZERO, to: WALLET, id: 88 }),
        ],
        tokenBalances: [{ token: { address_hash: USDG, exchange_rate: "1" } }, { token: { address_hash: CASHCAT, exchange_rate: "0.1" } }],
    });

    assert.equal(result.externalTokenOutflows.length, 0);
    assert.equal(result.sales[0].usdReceived, 250);
    assert.equal(result.purchases[0].usdValue, 250);
    assert.equal(result.purchases[0].externalBaseFunding, 0);
    assert.equal(result.lpLifecycle.positions.find((position) => position.positionId === "88")?.depositsUsd, 250);
    assert.equal(result.tokenPnl.find((position) => position.contract === CASHCAT)?.lpDeployedCost, 0.125);
});
