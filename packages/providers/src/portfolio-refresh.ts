import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { atomicAmount, atomicToDecimal, decimalAmount, multiplyDecimal } from "@dashboard/domain";

export interface RefreshWallet {
  key: string;
  tag: string;
  kind: string;
  address: string;
}

export interface RefreshedHolding {
  assetReference: string;
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  rawAmount: string;
  price: string;
  price24hChange: string | null;
  usdValue: string;
  logoUrl: string | null;
  walletKey: string;
  walletTag: string;
}

export interface RefreshedProtocolPosition {
  protocolReference: string;
  protocolName: string;
  chainId: string;
  logoUrl: string | null;
  walletKey: string;
  walletTag: string;
  position: unknown;
}

export interface RefreshedChain {
  chainId: string;
  name: string;
  logoUrl: string | null;
}

export interface RefreshSourceStatus {
  source: string;
  status: "succeeded" | "failed" | "skipped";
  walletCount: number;
  holdingCount: number;
  protocolCount: number;
  message: string | null;
}

export interface PortfolioRefreshResult {
  holdings: RefreshedHolding[];
  protocols: RefreshedProtocolPosition[];
  chains: RefreshedChain[];
  sources: RefreshSourceStatus[];
  complete: boolean;
}

export interface PortfolioRefreshOptions {
  debankAccessKey?: string | undefined;
  coingeckoApiKey?: string | undefined;
  solanaRpcUrl?: string | undefined;
  suiRpcUrl?: string | undefined;
  aptosApiUrl?: string | undefined;
}

export async function refreshAllPortfolioChains(
  wallets: RefreshWallet[],
  options: PortfolioRefreshOptions,
  signal: AbortSignal,
): Promise<PortfolioRefreshResult> {
  const holdings: RefreshedHolding[] = [];
  const protocols: RefreshedProtocolPosition[] = [];
  const chains = new Map<string, RefreshedChain>();
  const sources: RefreshSourceStatus[] = [];
  const tasks: Array<Promise<void>> = [];

  const run = (
    source: string,
    scopedWallets: RefreshWallet[],
    operation: () => Promise<{ holdings: RefreshedHolding[]; protocols?: RefreshedProtocolPosition[]; chains?: RefreshedChain[] }>,
  ) => {
    if (!scopedWallets.length) {
      sources.push({ source, status: "skipped", walletCount: 0, holdingCount: 0, protocolCount: 0, message: null });
      return;
    }
    tasks.push((async () => {
      try {
        const result = await operation();
        holdings.push(...result.holdings);
        protocols.push(...(result.protocols ?? []));
        for (const chain of result.chains ?? []) chains.set(chain.chainId, chain);
        sources.push({ source, status: "succeeded", walletCount: scopedWallets.length, holdingCount: result.holdings.length, protocolCount: result.protocols?.length ?? 0, message: null });
      } catch (error) {
        sources.push({ source, status: "failed", walletCount: scopedWallets.length, holdingCount: 0, protocolCount: 0, message: safeMessage(error) });
      }
    })());
  };

  const evmWallets = wallets.filter((wallet) => wallet.kind === "evm");
  run("debank", evmWallets, () => refreshDebank(evmWallets, options.debankAccessKey, signal));
  run("hyperliquid", evmWallets, () => refreshHyperliquid(evmWallets, signal));
  const solanaWallets = wallets.filter((wallet) => wallet.kind === "sol");
  run("solana", solanaWallets, () => refreshSolana(solanaWallets, options.solanaRpcUrl, signal));
  const suiWallets = wallets.filter((wallet) => wallet.kind === "sui");
  run("sui", suiWallets, () => refreshSui(suiWallets, options, signal));
  const cosmosWallets = wallets.filter((wallet) => wallet.kind === "cosmos");
  run("cosmos", cosmosWallets, () => refreshCosmos(cosmosWallets, options.coingeckoApiKey, signal));
  const aptosWallets = wallets.filter((wallet) => wallet.kind === "aptos");
  run("aptos", aptosWallets, () => refreshAptos(aptosWallets, options, signal));
  const supportedKinds = new Set(["evm", "sol", "sui", "cosmos", "aptos"]);
  for (const kind of new Set(wallets.map((wallet) => wallet.kind).filter((kind) => !supportedKinds.has(kind)))) {
    const count = wallets.filter((wallet) => wallet.kind === kind).length;
    sources.push({ source: `carried-forward:${kind}`, status: "skipped", walletCount: count, holdingCount: 0, protocolCount: 0, message: "No safe public live adapter; existing stored data remains unchanged" });
  }

  await Promise.all(tasks);
  sources.sort((left, right) => left.source.localeCompare(right.source));
  return { holdings, protocols, chains: [...chains.values()], sources, complete: wallets.length > 0 && sources.every((source) => source.status !== "failed") };
}

async function refreshDebank(wallets: RefreshWallet[], accessKey: string | undefined, signal: AbortSignal) {
  if (!accessKey?.trim()) throw new Error("DeBank access key is not configured locally");
  const headers = { AccessKey: accessKey, Accept: "application/json" };
  const chainValues = await jsonRequest<unknown[]>("https://pro-openapi.debank.com/v1/chain/list", { headers, signal });
  const chains = chainValues.map(object).flatMap((chain) => {
    const chainId = text(chain.id, "");
    return chainId ? [{ chainId, name: text(chain.name, chainId), logoUrl: httpsUrl(chain.logo_url) }] : [];
  });
  const holdings: RefreshedHolding[] = [];
  const protocols: RefreshedProtocolPosition[] = [];
  for (const wallet of wallets) {
    const [tokens, positions] = await Promise.all([
      jsonRequest<unknown[]>(`https://pro-openapi.debank.com/v1/user/all_token_list?id=${encodeURIComponent(wallet.address)}&is_all=false`, { headers, signal }),
      jsonRequest<unknown[]>(`https://pro-openapi.debank.com/v1/user/all_complex_protocol_list?id=${encodeURIComponent(wallet.address)}`, { headers, signal }),
    ]);
    for (const value of tokens) {
      const token = object(value);
      const rawAmount = integerText(token.raw_amount);
      const decimals = safeInteger(token.decimals, 0, 255);
      const amount = decimalText(token.amount);
      const price = decimalText(token.price);
      if (amount === "0" || amount.startsWith("-")) continue;
      holdings.push({
        assetReference: text(token.id, text(token.symbol, "unknown")),
        chainId: text(token.chain, "unknown"),
        name: text(token.name, text(token.symbol, "Unknown")),
        symbol: text(token.symbol, "Unknown"),
        decimals,
        amount,
        rawAmount: rawAmount ?? decimalToRaw(amount, decimals),
        price,
        price24hChange: nullableDecimalText(token.price_24h_change, "100"),
        usdValue: multiply(amount, price),
        logoUrl: httpsUrl(token.logo_url),
        walletKey: wallet.key,
        walletTag: wallet.tag,
      });
    }
    for (const value of positions) {
      const protocol = object(value);
      protocols.push({
        protocolReference: text(protocol.id, text(protocol.name, "unknown")),
        protocolName: text(protocol.name, "Unknown protocol"),
        chainId: text(protocol.chain, "unknown"),
        logoUrl: httpsUrl(protocol.logo_url),
        walletKey: wallet.key,
        walletTag: wallet.tag,
        position: protocol.portfolio_item_list ?? [],
      });
    }
  }
  return { holdings, protocols, chains };
}

async function refreshHyperliquid(wallets: RefreshWallet[], signal: AbortSignal) {
  const endpoint = "https://api.hyperliquid.xyz/info";
  const market = await jsonRequest<unknown[]>(endpoint, jsonPost({ type: "spotMetaAndAssetCtxs" }, signal));
  const meta = object(market[0]);
  const tokenMetadata = array(meta.tokens).map(object);
  const contexts = array(market[1]).map(object);
  const contextByCoin = new Map(contexts.map((context) => [text(context.coin, ""), context]));
  const holdings: RefreshedHolding[] = [];
  for (const wallet of wallets) {
    const state = object(await jsonRequest(endpoint, jsonPost({ type: "spotClearinghouseState", user: wallet.address }, signal)));
    for (const value of array(state.balances)) {
      const balance = object(value);
      const metadata = tokenMetadata.find((token) => String(token.index) === String(balance.token));
      if (!metadata) continue;
      const symbol = text(metadata.name, "Unknown");
      if (!new Set(["HYPE", "USDC"]).has(symbol) && decimalText(balance.entryNtl) === "0") continue;
      const decimals = safeInteger(metadata.weiDecimals, 0, 30);
      const amount = decimalText(balance.total);
      if (amount === "0") continue;
      const context = contextByCoin.get(symbol);
      const price = symbol === "USDC" ? "1" : decimalText(context?.midPx ?? context?.markPx);
      const previous = decimalText(context?.prevDayPx);
      holdings.push({ assetReference: String(balance.token), chainId: "hyperliquid", name: text(metadata.fullName, symbol), symbol, decimals, amount, rawAmount: decimalToRaw(amount, decimals), price, price24hChange: percentChange(price, previous), usdValue: multiply(amount, price), logoUrl: null, walletKey: wallet.key, walletTag: wallet.tag });
    }
  }
  return { holdings, chains: [{ chainId: "hyperliquid", name: "Hyperliquid L1", logoUrl: "/logos/hyper.png" }] };
}

async function refreshSolana(wallets: RefreshWallet[], rpcUrl = "https://api.mainnet-beta.solana.com", signal: AbortSignal) {
  const holdings: RefreshedHolding[] = [];
  const programs = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"];
  const metadataCache = new Map<string, Record<string, unknown> | null>();
  for (const wallet of wallets) {
    const native = object(await solanaRpc(rpcUrl, "getBalance", [wallet.address, { commitment: "confirmed" }], signal));
    const lamports = integerText(native.value) ?? "0";
    const solMetadata = await jupiterToken("So11111111111111111111111111111111111111112", metadataCache, signal);
    holdings.push(solanaHolding(wallet, "So11111111111111111111111111111111111111112", "Solana", "SOL", 9, lamports, solMetadata));
    for (const program of programs) {
      const response = object(await solanaRpc(rpcUrl, "getTokenAccountsByOwner", [wallet.address, { programId: program }, { encoding: "jsonParsed", commitment: "confirmed" }], signal));
      for (const accountValue of array(response.value)) {
        const info = object(object(object(accountValue).account).data);
        const parsed = object(info.parsed);
        const details = object(parsed.info);
        const tokenAmount = object(details.tokenAmount);
        const raw = integerText(tokenAmount.amount) ?? "0";
        if (raw === "0") continue;
        const mint = text(details.mint, "");
        if (!mint) continue;
        const metadata = await jupiterToken(mint, metadataCache, signal);
        holdings.push(solanaHolding(wallet, mint, text(metadata?.name, mint.slice(0, 8)), text(metadata?.symbol, mint.slice(0, 5)), safeInteger(tokenAmount.decimals, 0, 30), raw, metadata));
      }
    }
  }
  return { holdings, chains: [{ chainId: "sol", name: "Solana", logoUrl: "/logos/SOL.png" }] };
}

function solanaHolding(wallet: RefreshWallet, reference: string, name: string, symbol: string, decimals: number, raw: string, metadata: Record<string, unknown> | null): RefreshedHolding {
  const amount = atomicToDecimal(atomicAmount(raw), decimals);
  const price = decimalText(metadata?.usdPrice);
  return { assetReference: reference, chainId: "sol", name, symbol, decimals, amount, rawAmount: raw, price, price24hChange: nullableDecimalText(object(metadata?.stats24h).priceChange), usdValue: multiply(amount, price), logoUrl: httpsUrl(metadata?.icon), walletKey: wallet.key, walletTag: wallet.tag };
}

async function jupiterToken(mint: string, cache: Map<string, Record<string, unknown> | null>, signal: AbortSignal) {
  if (cache.has(mint)) return cache.get(mint) ?? null;
  const values = await jsonRequest<unknown[]>(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, { signal });
  const match = values.map(object).find((value) => value.id === mint) ?? null;
  cache.set(mint, match);
  return match;
}

async function refreshSui(wallets: RefreshWallet[], options: PortfolioRefreshOptions, signal: AbortSignal) {
  const rpc = options.suiRpcUrl ?? "https://fullnode.mainnet.sui.io:443";
  const prices = await coinGeckoPrices(["sui", "deep"], options.coingeckoApiKey, signal);
  const holdings: RefreshedHolding[] = [];
  for (const wallet of wallets) {
    const balances = array(await genericRpc(rpc, "suix_getAllBalances", [wallet.address], signal));
    for (const value of balances) {
      const balance = object(value);
      const coinType = text(balance.coinType, "");
      const metadata = object(await genericRpc(rpc, "suix_getCoinMetadata", [coinType], signal));
      const symbol = text(metadata.symbol, coinType.split("::").at(-1) ?? "Unknown");
      const priceKey = symbol.toUpperCase() === "SUI" ? "sui" : symbol.toUpperCase() === "DEEP" ? "deep" : "";
      const quote = object(prices[priceKey]);
      const decimals = safeInteger(metadata.decimals, 0, 30);
      const raw = integerText(balance.totalBalance) ?? "0";
      if (raw === "0") continue;
      const amount = atomicToDecimal(atomicAmount(raw), decimals);
      const price = decimalText(quote.usd);
      holdings.push({ assetReference: coinType, chainId: "sui", name: text(metadata.name, symbol), symbol, decimals, amount, rawAmount: raw, price, price24hChange: nullableDecimalText(quote.usd_24h_change), usdValue: multiply(amount, price), logoUrl: httpsUrl(metadata.iconUrl), walletKey: wallet.key, walletTag: wallet.tag });
    }
  }
  return { holdings, chains: [{ chainId: "sui", name: "Sui", logoUrl: "/logos/SUI.png" }] };
}

const cosmosChains = [
  ["cosmos", "Cosmos Hub", "ATOM", "cosmos", 6, "https://cosmos-rest.publicnode.com"],
  ["akash-network", "Akash", "AKT", "akash", 6, "https://akash-rest.publicnode.com"],
  ["osmosis", "Osmosis", "OSMO", "osmo", 6, "https://osmosis-rest.publicnode.com"],
  ["sei-network", "Sei", "SEI", "sei", 6, "https://sei-rest.publicnode.com"],
  ["celestia", "Celestia", "TIA", "celestia", 6, "https://celestia-rest.publicnode.com"],
  ["saga-2", "Saga", "SAGA", "saga", 6, "https://saga-rest.publicnode.com"],
] as const;

async function refreshCosmos(wallets: RefreshWallet[], apiKey: string | undefined, signal: AbortSignal) {
  const prices = await coinGeckoPrices(cosmosChains.map((chain) => chain[0]), apiKey, signal);
  const holdings: RefreshedHolding[] = [];
  for (const wallet of wallets) {
    const decoded = fromBech32(wallet.address);
    for (const [priceKey, name, symbol, prefix, decimals, endpoint] of cosmosChains) {
      const address = toBech32(prefix, decoded.data);
      const [bank, delegated, unbonding] = await Promise.all([
        jsonRequest<Record<string, unknown>>(`${endpoint}/cosmos/bank/v1beta1/balances/${address}`, { signal }),
        jsonRequest<Record<string, unknown>>(`${endpoint}/cosmos/staking/v1beta1/delegations/${address}`, { signal }),
        jsonRequest<Record<string, unknown>>(`${endpoint}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`, { signal }),
      ]);
      const liquid = array(bank.balances).filter((item) => !text(object(item).denom, "").startsWith("ibc/")).reduce<bigint>((sum, item) => sum + BigInt(integerText(object(item).amount) ?? "0"), 0n);
      const staked = array(delegated.delegation_responses).reduce<bigint>((sum, item) => sum + BigInt(integerText(object(object(item).balance).amount) ?? "0"), 0n);
      const unstaking = array(unbonding.unbonding_responses).flatMap((item) => array(object(item).entries)).reduce<bigint>((sum, item) => sum + BigInt(integerText(object(item).balance) ?? "0"), 0n);
      const raw = (liquid + staked + unstaking).toString();
      if (raw === "0") continue;
      const amount = atomicToDecimal(atomicAmount(raw), decimals);
      const quote = object(prices[priceKey]);
      const price = decimalText(quote.usd);
      holdings.push({ assetReference: priceKey, chainId: prefix, name, symbol, decimals, amount, rawAmount: raw, price, price24hChange: nullableDecimalText(quote.usd_24h_change), usdValue: multiply(amount, price), logoUrl: null, walletKey: wallet.key, walletTag: wallet.tag });
    }
  }
  return { holdings, chains: cosmosChains.map(([, name, symbol, prefix]) => ({ chainId: prefix, name, logoUrl: `/logos/${symbol}.png` })) };
}

async function refreshAptos(wallets: RefreshWallet[], options: PortfolioRefreshOptions, signal: AbortSignal) {
  const endpoint = options.aptosApiUrl ?? "https://api.mainnet.aptoslabs.com/v1";
  const prices = await coinGeckoPrices(["aptos"], options.coingeckoApiKey, signal);
  const quote = object(prices.aptos);
  const holdings: RefreshedHolding[] = [];
  for (const wallet of wallets) {
    const resources = await jsonRequest<unknown[]>(`${endpoint}/accounts/${wallet.address}/resources`, { signal });
    const coinStore = resources.map(object).find((resource) => text(resource.type, "").includes("0x1::aptos_coin::AptosCoin"));
    const raw = integerText(object(object(object(coinStore).data).coin).value) ?? "0";
    if (raw === "0") continue;
    const amount = atomicToDecimal(atomicAmount(raw), 8);
    const price = decimalText(quote.usd);
    holdings.push({ assetReference: "0x1::aptos_coin::AptosCoin", chainId: "aptos", name: "Aptos", symbol: "APT", decimals: 8, amount, rawAmount: raw, price, price24hChange: nullableDecimalText(quote.usd_24h_change), usdValue: multiply(amount, price), logoUrl: null, walletKey: wallet.key, walletTag: wallet.tag });
  }
  return { holdings, chains: [{ chainId: "aptos", name: "Aptos", logoUrl: "/logos/APT.png" }] };
}

async function coinGeckoPrices(ids: readonly string[], apiKey: string | undefined, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!ids.length) return {};
  const query = new URLSearchParams({ ids: ids.join(","), vs_currencies: "usd", include_24hr_change: "true" });
  if (apiKey?.trim()) query.set("x_cg_demo_api_key", apiKey.trim());
  return jsonRequest(`https://api.coingecko.com/api/v3/simple/price?${query}`, { signal });
}

async function solanaRpc(endpoint: string, method: string, params: unknown[], signal: AbortSignal) {
  return genericRpc(endpoint, method, params, signal);
}

async function genericRpc(endpoint: string, method: string, params: unknown[], signal: AbortSignal) {
  const response = object(await jsonRequest(endpoint, jsonPost({ jsonrpc: "2.0", id: 1, method, params }, signal)));
  if (response.error) throw new Error(`${method} RPC failed`);
  return response.result;
}

function jsonPost(body: unknown, signal: AbortSignal): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal };
}

async function jsonRequest<T = unknown>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function object(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown, fallback: string): string { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function safeInteger(value: unknown, minimum: number, maximum: number): number { const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : minimum; return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : minimum; }
function integerText(value: unknown): string | null { const source = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : ""; return /^\d+$/.test(source) ? source : null; }
function decimalText(value: unknown): string { const source = typeof value === "number" || typeof value === "string" ? String(value).trim() : "0"; if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(source)) return decimalAmount(source); const match = source.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/); if (!match) return "0"; const [, sign, whole = "0", fraction = "", exponentText = "0"] = match; const exponent = Number(exponentText); const digits = `${whole}${fraction}`; const index = whole.length + exponent; const plain = index <= 0 ? `${sign}0.${"0".repeat(-index)}${digits}` : index >= digits.length ? `${sign}${digits}${"0".repeat(index - digits.length)}` : `${sign}${digits.slice(0, index)}.${digits.slice(index)}`; return decimalAmount(plain); }
function nullableDecimalText(value: unknown, multiplier = "1"): string | null { return value === null || value === undefined ? null : multiply(decimalText(value), multiplier); }
function decimalToRaw(value: string, decimals: number): string { const [whole = "0", fraction = ""] = decimalAmount(value).split("."); return `${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^(-?)0+(?=\d)/, "$1") || "0"; }
function multiply(left: string, right: string): string { return multiplyDecimal(decimalAmount(left), decimalAmount(right)); }
function percentChange(current: string, previous: string): string | null { if (previous === "0") return null; const scale = 10n ** 8n; const currentAtomic = BigInt(decimalToRaw(current, 8)); const previousAtomic = BigInt(decimalToRaw(previous, 8)); return decimalAmount((((currentAtomic - previousAtomic) * 100n * scale) / previousAtomic).toString().replace(/(\d{8})$/, ".$1")); }
function httpsUrl(value: unknown): string | null { if (typeof value !== "string") return null; try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 180) : "provider request failed"; }
