const DEFAULT_TIME_ZONE = "Europe/Zurich";

const finiteNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizedPart = (value, fallback = "unknown") =>
  String(value || fallback).trim().toLowerCase();

export const getSnapshotDate = (
  value = new Date(),
  timeZone = process.env.TZ || DEFAULT_TIME_ZONE
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid snapshot date");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const tokenAssetKey = ({ chain_id: chainId, symbol, name, contract_address: contractAddress }) =>
  `token:${normalizedPart(chainId)}:${normalizedPart(contractAddress || symbol || name)}`;

export const protocolAssetKey = ({ name }) => `protocol:${normalizedPart(name)}`;

export const compactSnapshotAssets = ({ tokens = [], protocols = [] } = {}) => {
  const assets = new Map();

  (Array.isArray(tokens) ? tokens : []).forEach((token) => {
    const name = String(token?.name || token?.symbol || "Unknown token");
    const symbol = String(token?.symbol || token?.name || "UNKNOWN");
    const chainId = String(token?.chain_id || "unknown");
    const contractAddress = token?.contract_address ? String(token.contract_address) : null;
    const assetKey = tokenAssetKey({ chain_id: chainId, symbol, name, contract_address: contractAddress });
    const current = assets.get(assetKey) || {
      assetType: "token",
      assetKey,
      chainId,
      name,
      symbol,
      contractAddress,
      balance: 0,
      usdValue: 0,
    };

    current.contractAddress = current.contractAddress || contractAddress;
    current.balance += finiteNumber(token?.amount);
    current.usdValue += finiteNumber(
      token?.total_usd_value,
      finiteNumber(token?.amount) * finiteNumber(token?.price)
    );
    assets.set(assetKey, current);
  });

  (Array.isArray(protocols) ? protocols : []).forEach((protocol) => {
    const name = String(protocol?.name || "Unknown protocol");
    const assetKey = protocolAssetKey({ name });
    const current = assets.get(assetKey) || {
      assetType: "protocol",
      assetKey,
      chainId: null,
      name,
      symbol: null,
      balance: null,
      usdValue: 0,
    };
    current.usdValue += finiteNumber(
      protocol?.totalUSD,
      (Array.isArray(protocol?.positions) ? protocol.positions : []).reduce(
        (sum, position) => sum + finiteNumber(position?.usdValue),
        0
      )
    );
    assets.set(assetKey, current);
  });

  return [...assets.values()].filter((asset) => asset.usdValue > 0);
};

export const summarizeLegacyHistory = (history = {}) => {
  const tokens = Array.isArray(history?.tokens) ? history.tokens : [];
  const protocols = Array.isArray(history?.protocolsTable) ? history.protocolsTable : [];
  const tokenUsd = finiteNumber(
    history?.totalTokenUSD,
    tokens.reduce(
      (sum, token) =>
        sum +
        finiteNumber(
          token?.total_usd_value,
          finiteNumber(token?.amount) * finiteNumber(token?.price)
        ),
      0
    )
  );
  const protocolUsd = finiteNumber(
    history?.totalProtocolUSD,
    protocols.reduce(
      (sum, protocol) =>
        sum +
        finiteNumber(
          protocol?.totalUSD,
          (Array.isArray(protocol?.positions) ? protocol.positions : []).reduce(
            (positionSum, position) => positionSum + finiteNumber(position?.usdValue),
            0
          )
        ),
      0
    )
  );

  return {
    tokenUsd,
    protocolUsd,
    assets: compactSnapshotAssets({ tokens, protocols }),
  };
};
