import type { PortfolioRefreshResult, RefreshedHolding, RefreshedProtocolPosition, RefreshWallet } from "@dashboard/providers";

const chainNames: Record<string, string> = {
  eth: "Ethereum", base: "Base", arb: "Arbitrum", op: "Optimism", linea: "Linea", scroll: "Scroll",
  zksync: "ZKsync", matic: "Polygon", avax: "Avalanche", bsc: "BNB Chain", gnosis: "Gnosis",
  sol: "Solana", sui: "Sui", cosmos: "Cosmos", aptos: "Aptos", hyperliquid: "Hyperliquid L1",
};

export function projectRefresh(result: PortfolioRefreshResult, wallets: RefreshWallet[]) {
  const tokens = new Map<string, ReturnType<typeof tokenSeed>>();
  for (const holding of result.holdings) {
    const key = `${holding.chainId}:${holding.assetReference}`;
    const token = tokens.get(key) ?? tokenSeed(holding);
    token.amount = add(token.amount, holding.amount);
    token.total_usd_value = add(token.total_usd_value, holding.usdValue);
    const wallet = token.wallets.find((item) => item.tag === holding.walletTag);
    if (wallet) wallet.amount = add(wallet.amount, holding.amount);
    else token.wallets.push({ tag: holding.walletTag, amount: holding.amount });
    tokens.set(key, token);
  }

  const protocols = aggregateProtocols(result.protocols);
  const chainMetadata = new Map(result.chains.map((chain) => [chain.chainId, chain]));
  const chains = new Map<string, { chain_id: string; name: string; logo_path: string | null; usd_value: string; token_usd_value: string; protocol_usd_value: string }>();
  for (const token of tokens.values()) addChain(chains, chainMetadata, token.chain_id, token.total_usd_value, "0");
  for (const protocol of protocols) for (const position of protocol.positions) addChain(chains, chainMetadata, position.chain, "0", position.usdValue);
  const totalTokenUSD = [...tokens.values()].reduce((sum, token) => add(sum, token.total_usd_value), "0");
  const totalProtocolUSD = protocols.reduce((sum, protocol) => add(sum, protocol.totalUSD), "0");
  return {
    snapshot: {
      tokens: [...tokens.values()], chains: [...chains.values()], protocolsTable: protocols,
      wallets: wallets.map(({ key, tag, kind }) => ({ key, tag, kind })), totalTokenUSD, totalProtocolUSD,
    },
    totalValue: add(totalTokenUSD, totalProtocolUSD),
  };
}

function tokenSeed(holding: RefreshedHolding) {
  return { name: holding.name, symbol: holding.symbol, chain_id: holding.chainId, decimals: holding.decimals,
    logo_path: holding.logoUrl, price: holding.price, price_24h_change: holding.price24hChange,
    amount: "0", total_usd_value: "0", wallets: [] as Array<{ tag: string; amount: string }> };
}

function aggregateProtocols(values: RefreshedProtocolPosition[]) {
  const map = new Map<string, { name: string; totalUSD: string; positions: Array<{ type: string; chain: string; amount: string; price: string; usdValue: string; tokenNames: string; wallets: Array<{ tag: string }> }> }>();
  for (const value of values) {
    const total = protocolValue(value.position);
    if (total === "0") continue;
    const item = map.get(value.protocolReference) ?? { name: value.protocolName, totalUSD: "0", positions: [] };
    item.totalUSD = add(item.totalUSD, total);
    item.positions.push({ type: "DeFi position", chain: value.chainId, amount: "1", price: total, usdValue: total, tokenNames: value.protocolName, wallets: [{ tag: value.walletTag }] });
    map.set(value.protocolReference, item);
  }
  return [...map.values()];
}

function protocolValue(position: unknown): string {
  return array(position).reduce<string>((sum, entry) => add(sum, decimal(object(object(entry).stats).net_usd_value)), "0");
}

function addChain(
  map: Map<string, { chain_id: string; name: string; logo_path: string | null; usd_value: string; token_usd_value: string; protocol_usd_value: string }>,
  metadata: Map<string, { chainId: string; name: string; logoUrl: string | null }>,
  id: string,
  token: string,
  protocol: string,
) {
  const source = metadata.get(id);
  const row = map.get(id) ?? { chain_id: id, name: source?.name ?? chainNames[id] ?? id, logo_path: source?.logoUrl ?? null, usd_value: "0", token_usd_value: "0", protocol_usd_value: "0" };
  row.token_usd_value = add(row.token_usd_value, token); row.protocol_usd_value = add(row.protocol_usd_value, protocol); row.usd_value = add(row.token_usd_value, row.protocol_usd_value); map.set(id, row);
}
function add(left: string, right: string): string {
  const [aWhole = "0", aFraction = ""] = left.split(".");
  const [bWhole = "0", bFraction = ""] = right.split(".");
  const scale = Math.max(aFraction.length, bFraction.length);
  const a = BigInt(`${aWhole}${aFraction.padEnd(scale, "0")}`);
  const b = BigInt(`${bWhole}${bFraction.padEnd(scale, "0")}`);
  const negative = a + b < 0n;
  const digits = (negative ? -(a + b) : a + b).toString().padStart(scale + 1, "0");
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return `${negative ? "-" : ""}${value}`.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
function object(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function decimal(value: unknown): string { const text = typeof value === "number" || typeof value === "string" ? String(value) : "0"; return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) ? text : "0"; }
