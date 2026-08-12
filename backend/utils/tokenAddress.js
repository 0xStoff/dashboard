import EvmChains from "../models/EvmChainsModel.js";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const WRAPPED_SOL_ADDRESS = "So11111111111111111111111111111111111111112";

const GECKO_NETWORK_IDS = {
  eth: "eth",
  bsc: "bsc",
  polygon: "polygon_pos",
  polygon_pos: "polygon_pos",
  avax: "avax",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  op: "optimism",
  optimism: "optimism",
  base: "base",
  sol: "solana",
  solana: "solana",
  aptos: "aptos",
  sui: "sui-network",
  "sui-network": "sui-network",
};

export const getGeckoNetworkId = (chainId) => GECKO_NETWORK_IDS[String(chainId || "").trim().toLowerCase()] || null;

export const normalizeContractAddress = (chainId, contractAddress) => {
  const raw = String(contractAddress || "").trim();
  if (!raw) return null;

  const normalizedChainId = String(chainId || "").trim().toLowerCase();
  if (normalizedChainId === "sol" || normalizedChainId === "solana") {
    return SOL_ADDRESS_PATTERN.test(raw) ? raw : null;
  }

  if (EVM_ADDRESS_PATTERN.test(raw)) {
    return raw.toLowerCase();
  }

  return null;
};

export const resolveNativeMarketAddress = async (chainId) => {
  const normalizedChainId = String(chainId || "").trim().toLowerCase();
  if (normalizedChainId === "sol" || normalizedChainId === "solana") {
    return WRAPPED_SOL_ADDRESS;
  }

  const chain = await EvmChains.findOne({
    where: { chain_id: chainId },
    attributes: ["wrapped_token_id", "native_token_id"],
  });

  return normalizeContractAddress(
    normalizedChainId,
    chain?.wrapped_token_id || chain?.native_token_id || null
  );
};

export const resolveMarketTokenAddress = async ({ chainId, contractAddress }) => {
  const normalized = normalizeContractAddress(chainId, contractAddress);
  if (normalized) {
    return normalized;
  }

  return resolveNativeMarketAddress(chainId);
};
