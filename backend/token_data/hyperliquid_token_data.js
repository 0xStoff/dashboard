import axios from "axios";
import EvmChains from "../models/EvmChainsModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import fetchDebankData from "../utils/debank_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import { getCanonicalTokenLogo } from "../utils/token_logo.js";

const API_URL = "https://api.hyperliquid.xyz/info";
const CHAIN_ID = "hyperliquid";
const ALWAYS_TRACKED_SYMBOLS = new Set(["HYPE", "USDC"]);
const TOKEN_METADATA_CACHE_MS = 6 * 60 * 60 * 1000;

const requestInfo = async (body) => {
    const response = await axios.post(API_URL, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20_000,
    });
    return response.data;
};

export const buildHyperliquidPrices = (meta, assetContexts) => {
    const prices = new Map([[0, { price: 1, change: 0 }]]);
    const contextsByMarket = new Map(
        (assetContexts || []).map((context) => [context.coin, context])
    );

    meta.universe.forEach((market) => {
        const [baseToken, quoteToken] = market.tokens;
        if (quoteToken !== 0) return;

        const context = contextsByMarket.get(market.name);
        const price = Number(context?.midPx || context?.markPx || 0);
        if (price <= 0) return;

        const previousPrice = Number(context?.prevDayPx || 0);
        const change = previousPrice > 0
            ? (price - previousPrice) / previousPrice * 100
            : null;

        prices.set(baseToken, { price, change });
    });

    return prices;
};

const ensureChain = () => EvmChains.upsert({
    chain_id: CHAIN_ID,
    name: "Hyperliquid L1",
    native_token_id: CHAIN_ID,
    wrapped_token_id: null,
    logo_path: "hyper.png",
}, { conflictFields: ["chain_id"] });

const fetchMarketData = async () => {
    const [meta, assetContexts] = await requestInfo({ type: "spotMetaAndAssetCtxs" });
    return { meta, prices: buildHyperliquidPrices(meta, assetContexts) };
};

export const fetchAndSaveHyperliquidData = async (wallet, suppliedMarketData) => {
    await ensureChain();
    const marketData = suppliedMarketData || await fetchMarketData();
    const hypeMetadata = await fetchDebankData("/token", {
        chain_id: "hyper",
        id: "hyper",
    }, { ttlMs: TOKEN_METADATA_CACHE_MS });
    const state = await requestInfo({
        type: "spotClearinghouseState",
        user: wallet.wallet,
    });
    const retainedTokenIds = [];

    for (const balance of state.balances || []) {
        const amount = Number(balance.total || 0);
        if (amount <= 0) continue;

        const metadata = marketData.meta.tokens.find((token) => token.index === balance.token);
        if (!metadata) continue;
        // Hyperliquid accounts can receive arbitrary unsolicited spot tokens.
        // Keep native/stable balances and assets with an actual account cost,
        // rather than allowing spam marks to inflate the dashboard net worth.
        if (!ALWAYS_TRACKED_SYMBOLS.has(metadata.name) && Number(balance.entryNtl || 0) <= 0) continue;

        const usesDebankHypeMetadata = metadata.name === "HYPE";
        const quote = usesDebankHypeMetadata
            ? {
                price: Number(hypeMetadata?.price || 0),
                change: Number(hypeMetadata?.price_24h_change || 0) * 100,
            }
            : marketData.prices.get(balance.token) || { price: 0, change: 0 };
        const downloadedLogo = usesDebankHypeMetadata && hypeMetadata?.logo_url
            ? await downloadLogo(hypeMetadata.logo_url, hypeMetadata.id || "hyper")
            : null;
        const [token] = await TokenModel.upsert({
            chain_id: CHAIN_ID,
            name: metadata.fullName || metadata.name,
            symbol: metadata.name,
            decimals: metadata.weiDecimals,
            logo_path: getCanonicalTokenLogo(metadata.name) || downloadedLogo,
            price: quote.price,
            price_24h_change: quote.change,
        }, { conflictFields: ["chain_id", "symbol"], returning: true });

        retainedTokenIds.push(token.id);
        const rawAmount = BigInt(Math.round(amount * 10 ** metadata.weiDecimals)).toString();
        await WalletTokenModel.upsert({
            user_id: wallet.user_id,
            wallet_id: wallet.id,
            token_id: token.id,
            amount,
            raw_amount: rawAmount,
            usd_value: amount * quote.price,
        }, { conflictFields: ["wallet_id", "token_id"] });
    }

    const chainTokens = await TokenModel.findAll({ where: { chain_id: CHAIN_ID }, attributes: ["id"] });
    const staleTokenIds = chainTokens
        .map((token) => token.id)
        .filter((tokenId) => !retainedTokenIds.includes(tokenId));
    if (staleTokenIds.length) {
        await WalletTokenModel.destroy({ where: { wallet_id: wallet.id, token_id: staleTokenIds } });
    }

    return { wallet: wallet.tag, balancesUpdated: retainedTokenIds.length };
};

export const fetchAndSaveHyperliquidDataForAllWallets = async (userId) => {
    if (!userId) throw new Error("Missing authenticated user ID");
    await ensureChain();

    const marketData = await fetchMarketData();
    const wallets = await WalletModel.findAll({
        where: { chain: "evm", user_id: userId },
        order: [["id", "ASC"]],
    });

    const results = [];
    for (const wallet of wallets) {
        results.push(await fetchAndSaveHyperliquidData(wallet, marketData));
    }
    return { walletsUpdated: wallets.length, results };
};
