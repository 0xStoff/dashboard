import test from "node:test";
import assert from "node:assert/strict";
import { annualizeFeeApy, decodeHookPermissions, deriveRiskFlags, feePipsToRate } from "../services/poolRadarMath.js";

test("converts Uniswap fee pips to a rate", () => {
    assert.equal(feePipsToRate(500), 0.0005);
    assert.equal(feePipsToRate(3000), 0.003);
});

test("annualizes fees over an explicit timestamp window", () => {
    assert.ok(Math.abs(annualizeFeeApy({ feesUsd: 10, tvlUsd: 100_000, windowSeconds: 86_400 }) - 3.65) < 1e-12);
    assert.equal(annualizeFeeApy({ feesUsd: 10, tvlUsd: null, windowSeconds: 86_400 }), null);
});

test("decodes v4 hook permission bits", () => {
    const permissions = decodeHookPermissions("0x00000000000000000000000000000000000000c0");
    assert.equal(permissions.beforeSwap, true);
    assert.equal(permissions.afterSwap, true);
    assert.equal(permissions.beforeInitialize, false);
});

test("reports transparent low TVL and inactivity flags", () => {
    const flags = deriveRiskFlags({ tvlUsd: 500, windows: { "1h": { swaps: 0 } } });
    assert.deepEqual(flags.map(({ code }) => code), ["low-tvl", "inactive"]);
});
