import test from "node:test";
import assert from "node:assert/strict";
import { getCanonicalTokenLogo } from "../utils/token_logo.js";

test("uses the asset logo for ETH instead of its network logo", () => {
    assert.equal(getCanonicalTokenLogo("ETH"), "ETH.png");
    assert.equal(getCanonicalTokenLogo("eth"), "ETH.png");
});

test("leaves unknown token logos to their data provider", () => {
    assert.equal(getCanonicalTokenLogo("USDC"), null);
});
