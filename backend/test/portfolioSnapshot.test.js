import assert from "node:assert/strict";
import test from "node:test";
import { buildWalletValuationSummaries } from "../services/portfolioSnapshotService.js";

test("wallet summaries preserve wallet IDs and match canonical components", () => {
  const summaries = buildWalletValuationSummaries({
    tokens: [
      {
        valuation: { pricingMethod: "pool-implied" },
        wallets: [
          { id: 7, amount: 100, usd_value: 12.5 },
          { id: 8, amount: 50, usd_value: 6.25 },
        ],
      },
    ],
    protocols: [
      {
        positions: [
          {
            valuation: { method: "pool-implied" },
            wallets: [
              { id: 7, amount: 1, usdValue: 40 },
              { id: 8, amount: 1, usdValue: 20 },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(summaries, [
    {
      walletId: 7,
      tokenUsd: 12.5,
      protocolUsd: 40,
      totalUsd: 52.5,
      estimatedUsd: 52.5,
      unpricedAssetCount: 0,
      pricingMethods: ["pool-implied"],
    },
    {
      walletId: 8,
      tokenUsd: 6.25,
      protocolUsd: 20,
      totalUsd: 26.25,
      estimatedUsd: 26.25,
      unpricedAssetCount: 0,
      pricingMethods: ["pool-implied"],
    },
  ]);
});

test("duplicate wallet tags cannot merge canonical totals", () => {
  const summaries = buildWalletValuationSummaries({
    tokens: [
      {
        valuation: { pricingMethod: "direct" },
        wallets: [
          { id: 1, tag: "Degen", amount: 1, usd_value: 10 },
          { id: 2, tag: "Degen", amount: 1, usd_value: 20 },
        ],
      },
    ],
    protocols: [],
  });

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].totalUsd, 10);
  assert.equal(summaries[1].totalUsd, 20);
});
