import test from "node:test";
import assert from "node:assert/strict";
import {
  compactSnapshotAssets,
  getSnapshotDate,
  protocolAssetKey,
  summarizeLegacyHistory,
  tokenAssetKey,
} from "../utils/portfolioHistory.js";

test("getSnapshotDate respects the configured portfolio timezone", () => {
  assert.equal(getSnapshotDate("2026-07-26T22:30:00.000Z", "Europe/Zurich"), "2026-07-27");
  assert.equal(getSnapshotDate("2026-07-26T22:30:00.000Z", "UTC"), "2026-07-26");
});

test("asset keys are stable and case insensitive", () => {
  assert.equal(
    tokenAssetKey({ chain_id: "ETH", symbol: "USDC" }),
    tokenAssetKey({ chain_id: "eth", symbol: "usdc" })
  );
  assert.equal(protocolAssetKey({ name: "Aave V3" }), "protocol:aave v3");
});

test("compactSnapshotAssets keeps only chart fields and combines duplicates", () => {
  const assets = compactSnapshotAssets({
    tokens: [
      { chain_id: "eth", name: "USD Coin", symbol: "USDC", amount: 5, price: 1 },
      { chain_id: "eth", name: "USD Coin", symbol: "USDC", amount: 7, total_usd_value: 7 },
    ],
    protocols: [
      { name: "Aave", totalUSD: 20, positions: [{ wallets: [{ wallet: "private" }] }] },
    ],
  });

  assert.equal(assets.length, 2);
  assert.deepEqual(assets.find((asset) => asset.assetType === "token"), {
    assetType: "token",
    assetKey: "token:eth:usdc",
    chainId: "eth",
    name: "USD Coin",
    symbol: "USDC",
    contractAddress: null,
    balance: 12,
    usdValue: 12,
  });
  assert.equal(assets.find((asset) => asset.assetType === "protocol")?.usdValue, 20);
  assert.equal("positions" in assets.find((asset) => asset.assetType === "protocol"), false);
});

test("summarizeLegacyHistory recovers totals when summary fields are missing", () => {
  const summary = summarizeLegacyHistory({
    tokens: [{ chain_id: "sol", symbol: "SOL", name: "Solana", amount: 2, price: 100 }],
    protocolsTable: [{ name: "Kamino", positions: [{ usdValue: 50 }] }],
  });

  assert.equal(summary.tokenUsd, 200);
  assert.equal(summary.protocolUsd, 50);
  assert.equal(summary.assets.length, 2);
});
