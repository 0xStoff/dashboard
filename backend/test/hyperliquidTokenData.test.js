import assert from "node:assert/strict";
import test from "node:test";
import { buildHyperliquidPrices } from "../token_data/hyperliquid_token_data.js";

test("maps USDC-quoted Hyperliquid spot markets to token prices", () => {
    const prices = buildHyperliquidPrices({
        universe: [
            { name: "@107", tokens: [150, 0] },
            { name: "@108", tokens: [151, 150] },
        ],
    }, [
        { coin: "@107", midPx: "50", markPx: "49.9", prevDayPx: "40" },
        { coin: "@108", midPx: "2", prevDayPx: "1" },
    ]);

    assert.deepEqual(prices.get(0), { price: 1, change: 0 });
    assert.deepEqual(prices.get(150), { price: 50, change: 25 });
    assert.equal(prices.has(151), false);
});

test("matches spot contexts by market name rather than array position", () => {
    const prices = buildHyperliquidPrices({
        universe: [{ name: "@107", tokens: [150, 0] }],
    }, [
        { coin: "@105", midPx: "0.14", prevDayPx: "0.12" },
        { coin: "@107", midPx: "58.72", prevDayPx: "58.00" },
    ]);

    assert.equal(prices.get(150).price, 58.72);
    assert.ok(Math.abs(prices.get(150).change - 1.2413793103) < 1e-9);
});
