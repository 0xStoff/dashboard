import test from "node:test";
import assert from "node:assert/strict";
import { calculateRobinhoodPerformance } from "../services/robinhood/performanceAccounting.js";

const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const router = "0x3333333333333333333333333333333333333333";
const bridge = "0xd29c85f15df544ba632c9e25829fd29d767d7978";
const eth = (value) => String(BigInt(Math.round(value * 1e9)) * 10n ** 9n);
const party = (hash, name = null) => ({ hash, name });
const transfer = ({ hash, from, to, quantity, timestamp }) => ({
    transaction_hash: hash,
    timestamp,
    from: party(from),
    to: party(to),
    token_type: "ERC-20",
    total: { value: String(quantity * 1e18), decimals: "18" },
    token: { address_hash: token, symbol: "TEST", name: "Test Token", decimals: "18", exchange_rate: "2" },
});

test("calculates funding, FIFO reinvestment and average-cost P&L", () => {
    const transactions = [
        { hash: "fund", timestamp: "2026-01-01T00:00:00Z", from: party(router), to: party(wallet), value: eth(0.1), status: "ok" },
        { hash: "buy1", timestamp: "2026-01-03T00:00:00Z", from: party(wallet), to: party(router), value: eth(0.05), fee: { value: "0" }, status: "ok" },
        { hash: "sale", timestamp: "2026-01-04T00:00:00Z", from: party(wallet), to: party(router), value: "0", fee: { value: "0" }, status: "ok" },
        { hash: "buy2", timestamp: "2026-01-05T00:00:00Z", from: party(wallet), to: party(router), value: eth(0.02), fee: { value: "0" }, status: "ok" },
        { hash: "withdraw", timestamp: "2026-01-06T00:00:00Z", from: party(wallet), to: { ...party("0x4444444444444444444444444444444444444444"), is_contract: false }, value: eth(0.04), fee: { value: "0" }, status: "ok" },
    ];
    const internalTransactions = [
        { transaction_hash: "bridge", timestamp: "2026-01-02T00:00:00Z", from: party(bridge, "Universal_SpokePool"), to: party(wallet), value: eth(0.2), success: true },
        { transaction_hash: "sale", timestamp: "2026-01-04T00:00:00Z", from: party(router), to: party(wallet), value: eth(0.03), success: true },
    ];
    const tokenTransfers = [
        transfer({ hash: "buy1", from: router, to: wallet, quantity: 100, timestamp: "2026-01-03T00:00:00Z" }),
        transfer({ hash: "sale", from: wallet, to: router, quantity: 50, timestamp: "2026-01-04T00:00:00Z" }),
        transfer({ hash: "buy2", from: router, to: wallet, quantity: 20, timestamp: "2026-01-05T00:00:00Z" }),
    ];
    const result = calculateRobinhoodPerformance({
        address: wallet,
        account: { coin_balance: eth(0.22), exchange_rate: "2000" },
        transactions,
        internalTransactions,
        tokenTransfers,
        tokenBalances: [],
    });

    assert.equal(result.funding.directFunding, 0.1);
    assert.equal(result.funding.bridgeFunding, 0.2);
    assert.ok(Math.abs(result.funding.grossExternalFunding - 0.3) < 1e-12);
    assert.equal(result.funding.externalWithdrawals, 0.04);
    assert.ok(Math.abs(result.funding.externalFunding - 0.26) < 1e-12);
    assert.ok(Math.abs(result.funding.saleProceedsReinvested - 0.02) < 1e-12);
    assert.ok(Math.abs(result.funding.saleProceedsUnspent - 0.01) < 1e-12);
    assert.equal(result.sales[0].reinvestmentStatus, "Partially reinvested");
    assert.ok(Math.abs(result.tokenPnl[0].costBasisSold - 0.025) < 1e-12);
    assert.ok(Math.abs(result.tokenPnl[0].realizedPnlEth - 0.005) < 1e-12);
    assert.equal(result.reconciliation.status, "OK");
});

test("caps investment-attributable balance and leaves missing prices unpriced", () => {
    const result = calculateRobinhoodPerformance({
        address: wallet,
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: "buy", timestamp: "2026-01-01T00:00:00Z", from: party(wallet), to: party(router), value: eth(0.1), fee: { value: "0" }, status: "ok" },
        ],
        internalTransactions: [],
        tokenTransfers: [
            { ...transfer({ hash: "airdrop", from: router, to: wallet, quantity: 1000, timestamp: "2025-12-31T00:00:00Z" }), token: { address_hash: token, symbol: "TEST", name: "Test Token", decimals: "18" } },
            { ...transfer({ hash: "buy", from: router, to: wallet, quantity: 100, timestamp: "2026-01-01T00:00:00Z" }), token: { address_hash: token, symbol: "TEST", name: "Test Token", decimals: "18" } },
        ],
        tokenBalances: [],
    });

    assert.equal(result.purchases.length, 1);
    assert.equal(result.tokenPnl[0].walletBalance, 1100);
    assert.equal(result.tokenPnl[0].attributableBalance, 100);
    assert.equal(result.tokenPnl[0].pricingStatus, "Unpriced");
    assert.equal(result.tokenPnl[0].unrealizedPnlEth, null);
    assert.equal(result.summary.partial, true);
});

test("marks user-confirmed Robinhood exits as closed despite incomplete transfer history", () => {
    const closedContract = "0x8c515613d4910a989d1465f931bb5004b42cccf7";
    const result = calculateRobinhoodPerformance({
        address: wallet,
        account: { coin_balance: "0", exchange_rate: "2000" },
        transactions: [
            { hash: "buy", timestamp: "2026-01-01T00:00:00Z", from: party(wallet), to: party(router), value: eth(0.03), fee: { value: "0" }, status: "ok" },
        ],
        internalTransactions: [],
        tokenTransfers: [{
            ...transfer({ hash: "buy", from: router, to: wallet, quantity: 100, timestamp: "2026-01-01T00:00:00Z" }),
            token: { address_hash: closedContract, symbol: "$1", name: "$1 is all you need", decimals: "18" },
        }],
        tokenBalances: [],
    });

    assert.equal(result.tokenPnl[0].walletBalance, 100);
    assert.equal(result.tokenPnl[0].manuallyClosed, true);
});
