import { QueryTypes } from "sequelize";
import sequelize from "../sequelize.js";
import PortfolioAssetSnapshot from "../models/PortfolioAssetSnapshotModel.js";
import { getProtocolsTable } from "./protocolService.js";
import { getTokensForUser } from "./tokenService.js";
import { getAvailableChains } from "./chainService.js";
import { FUEL_CONTRACT } from "./valuationService.js";
import { compactSnapshotAssets, getSnapshotDate } from "../utils/portfolioHistory.js";
import { persistAssetCatalog } from "../db/portfolioHistoryPersistence.js";

const roundCurrency = (value) => Number(Number(value || 0).toFixed(8));
const lower = (value) => String(value || "").toLowerCase();

const tokenMatches = (token, query) => {
  if (!query) return true;
  const normalizedQuery = lower(query);
  return [token.symbol, token.name, token.contract_address]
    .some((value) => lower(value).includes(normalizedQuery));
};

const positionMatches = (position, query) => {
  if (!query) return true;
  const normalizedQuery = lower(query);
  return [position.tokenNames, position.tokenSymbols, ...(position.contractAddresses || [])]
    .some((value) => lower(value).includes(normalizedQuery));
};

const getImpliedFuelPrice = (protocols) => {
  const totals = protocols
    .flatMap((protocol) => protocol.positions || [])
    .flatMap((position) => position.assetAmounts || [])
    .filter((asset) => lower(asset.contract) === FUEL_CONTRACT)
    .filter((asset) => Number(asset.price || 0) > 0 && asset.pricingMethod === "pool-implied")
    .reduce(
      (acc, asset) => ({
        amount: acc.amount + Number(asset.amount || 0),
        usdValue: acc.usdValue + Number(asset.usdValue || 0),
      }),
      { amount: 0, usdValue: 0 }
    );

  if (totals.amount <= 0 || totals.usdValue <= 0) return null;
  return {
    priceUsd: totals.usdValue / totals.amount,
    source: "CASHCAT/FUEL LP counter-leg valuation",
    confidence: "estimated",
  };
};

const applyCanonicalTokenValuations = (tokens, fuelPrice) =>
  tokens.map((token) => {
    const isFuel = lower(token.contract_address) === FUEL_CONTRACT;
    const directPrice = Number(token.price || 0);
    const price = isFuel && directPrice <= 0 && fuelPrice ? fuelPrice.priceUsd : directPrice;
    const pricingMethod = isFuel && directPrice <= 0 && fuelPrice
      ? "pool-implied"
      : directPrice > 0 ? "direct" : "unavailable";
    const totalUsdValue = Number(token.amount || 0) * price;

    return {
      ...token,
      price,
      total_usd_value: totalUsdValue,
      wallets: (token.wallets || []).map((wallet) => ({
        ...wallet,
        usd_value: Number(wallet.amount || 0) * price,
      })),
      valuation: {
        amountUsd: totalUsdValue,
        pricingMethod,
        confidence: pricingMethod === "pool-implied" ? "estimated" : pricingMethod === "direct" ? "direct" : "unavailable",
        source: pricingMethod === "pool-implied" ? fuelPrice?.source : pricingMethod === "direct" ? "stored provider quote" : "no usable quote",
      },
    };
  });

const filterProtocols = (protocols, { chain, searchQuery }) => {
  const normalizedQuery = lower(searchQuery);
  return protocols
    .map((protocol) => {
      const nameMatches = normalizedQuery && lower(protocol.name).includes(normalizedQuery);
      const positions = (protocol.positions || []).filter((position) => {
        const chainMatches = chain === "all" || position.chain === chain;
        return chainMatches && (!normalizedQuery || nameMatches || positionMatches(position, normalizedQuery));
      });
      const totalUSD = roundCurrency(positions.reduce((sum, position) => sum + Number(position.usdValue || 0), 0));
      return positions.length && totalUSD > 0 ? { ...protocol, positions, totalUSD } : null;
    })
    .filter(Boolean)
    .sort((left, right) => right.totalUSD - left.totalUSD);
};

const buildChainSummaries = async ({ tokens, protocols }) => {
  const summaries = new Map();
  const ensure = (chainId) => {
    if (!summaries.has(chainId)) {
      summaries.set(chainId, {
        chain_id: chainId,
        total_usd_value: 0,
        token_usd_value: 0,
        protocol_usd_value: 0,
      });
    }
    return summaries.get(chainId);
  };

  tokens.forEach((token) => {
    const summary = ensure(token.chain_id);
    const value = Number(token.total_usd_value || 0);
    summary.total_usd_value += value;
    summary.token_usd_value += value;
  });
  protocols.forEach((protocol) => {
    (protocol.positions || []).forEach((position) => {
      const summary = ensure(position.chain);
      const value = Number(position.usdValue || 0);
      summary.total_usd_value += value;
      summary.protocol_usd_value += value;
    });

  });

  const knownChains = await getAvailableChains();
  const knownById = new Map(knownChains.map((chain) => [chain.chain_id, chain]));
  return [...summaries.values()]
    .filter((summary) => summary.total_usd_value > 0)
    .map((summary) => {
      const chain = knownById.get(summary.chain_id) || {};
      return {
        id: Number(chain.id ?? 0),
        chain_id: summary.chain_id,
        name: chain.name || summary.chain_id,
        native_token_id: chain.native_token_id || null,
        wrapped_token_id: chain.wrapped_token_id || null,
        logo_path: chain.logo_path || "",
        type: chain.type || "unknown",
        usd_value: roundCurrency(summary.total_usd_value),
        token_usd_value: roundCurrency(summary.token_usd_value),
        protocol_usd_value: roundCurrency(summary.protocol_usd_value),
      };
    })
    .sort((left, right) => right.usd_value - left.usd_value);
};

// Wallet settings, chips, chains and tables must all draw from the same value
// components. This aggregation intentionally works from already-canonical
// token/position values rather than persisted provider totals.
export const buildWalletValuationSummaries = ({ tokens, protocols }) => {
  const summaries = new Map();
  const ensure = (wallet) => {
    const walletId = Number(wallet?.id);
    if (!Number.isFinite(walletId) || walletId <= 0) return null;
    if (!summaries.has(walletId)) {
      summaries.set(walletId, {
        walletId,
        tokenUsd: 0,
        protocolUsd: 0,
        estimatedUsd: 0,
        unpricedAssetCount: 0,
        pricingMethods: new Set(),
      });
    }
    return summaries.get(walletId);
  };

  (tokens || []).forEach((token) => {
    const pricingMethod = token?.valuation?.pricingMethod || "unavailable";
    (token.wallets || []).forEach((wallet) => {
      const summary = ensure(wallet);
      if (!summary) return;
      const value = Number(wallet.usd_value || 0);
      summary.tokenUsd += value;
      summary.pricingMethods.add(pricingMethod);
      if (pricingMethod === "pool-implied") summary.estimatedUsd += value;
      if (pricingMethod === "unavailable" && Number(wallet.amount || 0) > 0) summary.unpricedAssetCount += 1;
    });
  });

  (protocols || []).forEach((protocol) => {
    (protocol.positions || []).forEach((position) => {
      const pricingMethod = position?.valuation?.method || "unavailable";
      (position.wallets || []).forEach((wallet) => {
        const summary = ensure(wallet);
        if (!summary) return;
        const value = Number(wallet.usdValue || 0);
        summary.protocolUsd += value;
        summary.pricingMethods.add(pricingMethod);
        if (pricingMethod === "pool-implied" || pricingMethod === "mixed") summary.estimatedUsd += value;
        if (pricingMethod === "unavailable" && Number(wallet.amount || 0) > 0) summary.unpricedAssetCount += 1;
      });
    });
  });

  return [...summaries.values()]
    .map((summary) => ({
      walletId: summary.walletId,
      tokenUsd: roundCurrency(summary.tokenUsd),
      protocolUsd: roundCurrency(summary.protocolUsd),
      totalUsd: roundCurrency(summary.tokenUsd + summary.protocolUsd),
      estimatedUsd: roundCurrency(summary.estimatedUsd),
      unpricedAssetCount: summary.unpricedAssetCount,
      pricingMethods: [...summary.pricingMethods].sort(),
    }))
    .sort((left, right) => left.walletId - right.walletId);
};

// The read snapshot is the only source the dashboard should use for a given
// filter state. It deliberately calculates chains, tables and headline totals
// from the exact same in-memory assets and positions, avoiding stale fields and
// mixed request timing in the browser.
export const getPortfolioSnapshot = async ({ userId, chain = "all", walletId = "all", searchQuery = "" }) => {
  if (!userId) throw new Error("A user ID is required to build a portfolio snapshot");

  const [rawTokens, rawProtocols] = await Promise.all([
    getTokensForUser({ chain: "all", walletId, searchQuery: "", minimumUsdValue: 0, userId }),
    getProtocolsTable({ chain: "all", walletId, searchQuery: "", userId }),
  ]);
  const fuelPrice = getImpliedFuelPrice(rawProtocols);
  const allTokens = applyCanonicalTokenValuations(rawTokens, fuelPrice);
  const walletSummaries = buildWalletValuationSummaries({ tokens: allTokens, protocols: rawProtocols });
  const searchedTokens = allTokens.filter((token) => tokenMatches(token, searchQuery));
  const searchedProtocols = filterProtocols(rawProtocols, { chain: "all", searchQuery });
  const assets = searchedTokens
    .filter((token) => chain === "all" || token.chain_id === chain)
    .sort((left, right) => Number(right.total_usd_value || 0) - Number(left.total_usd_value || 0));
  const protocols = filterProtocols(searchedProtocols, { chain, searchQuery: "" });
  const totals = {
    tokenUsd: roundCurrency(assets.reduce((sum, token) => sum + Number(token.total_usd_value || 0), 0)),
    protocolUsd: roundCurrency(protocols.reduce((sum, protocol) => sum + Number(protocol.totalUSD || 0), 0)),
  };
  totals.totalUsd = roundCurrency(totals.tokenUsd + totals.protocolUsd);
  const chains = await buildChainSummaries({ tokens: searchedTokens, protocols: searchedProtocols });
  const chainsUsd = roundCurrency(chains.reduce((sum, item) => sum + Number(item.usd_value || 0), 0));
  const estimatedAssets = assets.filter((asset) => asset.valuation?.pricingMethod === "pool-implied");

  return {
    schemaVersion: 1,
    snapshotId: `live-${Date.now()}`,
    capturedAt: new Date().toISOString(),
    filters: { chain, walletId, searchQuery },
    totals,
    chains,
    assets,
    protocols,
    walletSummaries,
    dataHealth: {
      source: "canonical-server-snapshot",
      totalMatchesChainSummary: Math.abs(totals.totalUsd - chainsUsd) < 0.000001,
      estimatedAssetCount: estimatedAssets.length,
      fuelPrice,
      warnings: fuelPrice
        ? ["FUEL wallet holdings use a pool-implied estimate, not an executable market quote."]
        : [],
    },
  };
};

export const capturePortfolioSnapshot = async (userId, capturedAt = new Date()) => {
  if (!userId) {
    throw new Error("A user ID is required to capture portfolio history");
  }

  const portfolio = await getPortfolioSnapshot({ userId });
  const { assets: tokens, protocols } = portfolio;
  const { tokenUsd, protocolUsd, totalUsd } = portfolio.totals;

  if (totalUsd <= 0) {
    return { skipped: true, reason: "Portfolio total is empty" };
  }

  const assets = compactSnapshotAssets({ tokens, protocols });
  const snapshotDate = getSnapshotDate(capturedAt);

  return sequelize.transaction(async (transaction) => {
    const [snapshot] = await sequelize.query(
      `
        INSERT INTO portfolio_snapshots
          (user_id, captured_at, snapshot_date, total_usd, token_usd, protocol_usd)
        VALUES
          (:userId, :capturedAt, :snapshotDate, :totalUsd, :tokenUsd, :protocolUsd)
        ON CONFLICT (user_id, snapshot_date)
        DO UPDATE SET
          captured_at = EXCLUDED.captured_at,
          total_usd = EXCLUDED.total_usd,
          token_usd = EXCLUDED.token_usd,
          protocol_usd = EXCLUDED.protocol_usd
        RETURNING id, snapshot_date AS "snapshotDate", total_usd AS "totalUsd"
      `,
      {
        replacements: { userId, capturedAt, snapshotDate, totalUsd, tokenUsd, protocolUsd },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    await PortfolioAssetSnapshot.destroy({
      where: { snapshotId: snapshot.id },
      transaction,
    });

    if (assets.length) {
      const assetIds = await persistAssetCatalog({ userId, assets, transaction });
      await PortfolioAssetSnapshot.bulkCreate(
        assets.map((asset) => ({
          snapshotId: snapshot.id,
          assetId: assetIds.get(asset.assetKey),
          balance: asset.balance,
          usdValue: asset.usdValue,
        })),
        { transaction }
      );
    }

    return {
      skipped: false,
      snapshotDate: snapshot.snapshotDate,
      totalUsd: Number(snapshot.totalUsd),
      assetCount: assets.length,
    };
  });
};
