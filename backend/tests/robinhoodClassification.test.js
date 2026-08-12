import test from "node:test";
import assert from "node:assert/strict";
import { applyRobinhoodClassifications } from "../services/robinhood/classificationService.js";

test("manual LP assignments reconstruct lifecycle cash flow and total portfolio P&L", () => {
    const event = {
        hash: `0x${"a".repeat(64)}`,
        wallet: "0xwallet",
        timestamp: "2026-08-10T08:00:00Z",
        nativeDepositUsd: 100,
        tokenDepositUsd: 100,
        nativeReturnedUsd: 0,
        returnedUsd: 25,
        gasUsd: 1,
        valuationStatus: "valued",
        depositedTokens: [{ symbol: "USDG" }],
        returnedTokens: [],
    };
    const result = applyRobinhoodClassifications({
        summary: { totalPnlUsd: 50 },
        lpLifecycle: { positions: [], unmatchedMovements: [event] },
        lpPerformance: [],
        currentState: {
            protocolPositions: [{ id: "live-1", walletTag: "Degen", currentValueUsd: 225, assets: [{ symbol: "ETH" }, { symbol: "USDG" }] }],
        },
    }, [{
        transactionHash: event.hash,
        classification: "lp",
        lifecycleKey: "live-1",
        label: null,
        notes: null,
        metadata: { status: "open" },
    }]);

    assert.equal(result.lpLifecycle.unmatchedMovements.length, 0);
    assert.equal(result.lpLifecycle.positions.length, 1);
    assert.equal(result.lpLifecycle.positions[0].pair, "ETH / USDG");
    assert.equal(result.lpLifecycle.positions[0].pnlUsd, 49);
    assert.equal(result.portfolioPnl.tokenPnlUsd, 50);
    assert.equal(result.portfolioPnl.lpPnlUsd, 49);
    assert.equal(result.portfolioPnl.totalPnlUsd, 99);
    assert.equal(result.portfolioPnl.completeness, "complete");
});

test("closed exact LP lifecycles contribute realized P&L once", () => {
    const result = applyRobinhoodClassifications({
        summary: { totalPnlUsd: 10 },
        lpLifecycle: {
            unmatchedMovements: [],
            positions: [{
                positionId: "42",
                status: "closed",
                valuationStatus: "valued",
                depositsUsd: 1000,
                returnedUsd: 1075,
                gasUsd: 5,
            }],
        },
        lpPerformance: [],
        currentState: { protocolPositions: [] },
    }, []);

    assert.equal(result.portfolioPnl.lpPnlUsd, 70);
    assert.equal(result.portfolioPnl.totalPnlUsd, 80);
    assert.equal(result.portfolioPnl.completeness, "complete");
});

test("repositioned NFT lifecycles are combined once at pair strategy level", () => {
    const result = applyRobinhoodClassifications({
        summary: { totalPnlUsd: 25 },
        lpLifecycle: {
            unmatchedMovements: [],
            positions: [{
                positionId: "old",
                status: "closed",
                valuationStatus: "valued",
                depositsUsd: 1000,
                returnedUsd: 980,
                gasUsd: 1,
                events: [{ depositedTokens: [{ symbol: "USDG" }], returnedTokens: [{ symbol: "USDG" }] }],
            }, {
                positionId: "live",
                status: "open",
                valuationStatus: "valued",
                depositsUsd: 980,
                returnedUsd: 0,
                gasUsd: 1,
                events: [{ depositedTokens: [{ symbol: "USDG" }], returnedTokens: [] }],
            }],
        },
        lpPerformance: [{ positionId: "live", pair: "ETH / USDG", currentValueUsd: 1030 }],
        currentState: { protocolPositions: [] },
    }, []);

    assert.equal(result.lpStrategies.length, 1);
    assert.deepEqual(result.lpStrategies[0].positionIds, ["old", "live"]);
    assert.equal(result.lpStrategies[0].pnlUsd, 28);
    assert.equal(result.portfolioPnl.lpPnlUsd, 28);
    assert.equal(result.portfolioPnl.totalPnlUsd, 53);
});

test("an incomplete NFT makes the whole active pair pending instead of a false loss", () => {
    const result = applyRobinhoodClassifications({
        summary: { totalPnlUsd: 50 },
        lpLifecycle: {
            unmatchedMovements: [],
            positions: [{
                positionId: "old",
                status: "open",
                valuationStatus: "partial",
                depositsUsd: 1000,
                returnedUsd: 0,
                gasUsd: 1,
                events: [{ depositedTokens: [{ symbol: "CASHCAT" }], returnedTokens: [] }],
            }, {
                positionId: "live",
                status: "open",
                valuationStatus: "valued",
                depositsUsd: 500,
                returnedUsd: 0,
                gasUsd: 1,
                events: [{ depositedTokens: [{ symbol: "CASHCAT" }], returnedTokens: [] }],
            }],
        },
        lpPerformance: [{ positionId: "live", pair: "ETH / CASHCAT", currentValueUsd: 600 }],
        currentState: { protocolPositions: [] },
    }, []);

    assert.equal(result.lpStrategies.length, 1);
    assert.equal(result.lpStrategies[0].pnlUsd, null);
    assert.equal(result.portfolioPnl.lpPnlUsd, null);
    assert.equal(result.portfolioPnl.totalPnlUsd, null);
    assert.equal(result.portfolioPnl.knownTotalPnlUsd, 50);
    assert.equal(result.portfolioPnl.completeness, "partial");
});
