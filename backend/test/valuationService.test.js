import assert from "node:assert/strict";
import test from "node:test";
import { FUEL_CONTRACT, getProtocolPositionValuation } from "../services/valuationService.js";

test("pool-implied FUEL LP valuation includes both legs exactly once", () => {
  const result = getProtocolPositionValuation({
    detail: {
      supply_token_list: [
        { id: FUEL_CONTRACT, amount: 1_000_000, price: 0 },
        { id: "0xcashcat", amount: 125, price: 2.4 },
      ],
    },
  });

  assert.equal(result.pricing.method, "pool-implied");
  assert.equal(result.pricing.confidence, "estimated");
  assert.equal(result.pricing.inferredAssetPrices[0].priceUsd, 0.0003);
  assert.equal(result.usdValue, 600);
});

test("provider position valuation stays direct when a usable quote exists", () => {
  const result = getProtocolPositionValuation({
    stats: { net_usd_value: 42.5 },
    detail: { supply_token_list: [{ id: "0xother", amount: 1, price: 42.5 }] },
  });

  assert.equal(result.usdValue, 42.5);
  assert.equal(result.pricing.method, "provider");
  assert.equal(result.pricing.confidence, "direct");
});

test("asset_token_list fallback uses the same pool-implied FUEL policy", () => {
  const result = getProtocolPositionValuation({
    detail: {
      asset_token_list: [
        { id: FUEL_CONTRACT, amount: 100, price: 0 },
        { id: "0xcashcat", amount: 2, price: 5 },
      ],
    },
  });

  assert.equal(result.pricing.method, "pool-implied");
  assert.equal(result.pricing.inferredAssetPrices[0].priceUsd, 0.1);
  assert.equal(result.usdValue, 20);
});

test("unpriceable LP is explicit rather than silently valued at zero", () => {
  const result = getProtocolPositionValuation({
    detail: {
      supply_token_list: [
        { id: FUEL_CONTRACT, amount: 1_000_000, price: 0 },
        { id: "0xcashcat", amount: 0, price: 0 },
      ],
    },
  });

  assert.equal(result.usdValue, 0);
  assert.equal(result.pricing.method, "unavailable");
});
