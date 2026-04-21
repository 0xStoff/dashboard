import { Op } from "sequelize";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import { getHideSmallBalances } from "./settingsService.js";
import { SUPPORTED_TRACKED_WALLET_CHAINS } from "../config/supportedChains.js";

const TOKEN_ATTRIBUTES = [
    "name",
    "symbol",
    "decimals",
    "price",
    "logo_path",
    "chain_id",
    "price_24h_change",
];

export const fetchWalletTokenData = async ({ chain, minimumUsdValue, walletId, userId }) => {
    const walletWhereClause = {
        user_id: userId,
        chain: { [Op.in]: SUPPORTED_TRACKED_WALLET_CHAINS },
    };
    if (walletId && walletId !== "all") {
        walletWhereClause.id = walletId;
    }

    const tokenWhereClause = {};
    if (chain && chain !== "all") {
        tokenWhereClause.chain_id = chain;
    }

    return WalletModel.findAll({
        where: walletWhereClause,
        include: [
            {
                model: TokenModel,
                where: tokenWhereClause,
                through: {
                    model: WalletTokenModel,
                    attributes: ["amount", "raw_amount", "usd_value"],
                    where: minimumUsdValue
                        ? { usd_value: { [Op.gt]: minimumUsdValue } }
                        : {},
                },
                attributes: TOKEN_ATTRIBUTES,
            },
            {
                model: ProtocolModel,
                through: {
                    model: WalletProtocolModel,
                    attributes: ["portfolio_item_list"],
                },
                attributes: ["name", "logo_path", "chain_id"],
            },
        ],
        nest: true,
    });
};

export const aggregateTokens = async (wallets) => {
    const tokenMap = new Map();
    const hideSmallBalances = await getHideSmallBalances();

    wallets.forEach(({ id: walletId, wallet: walletAddress, tag, tokens }) => {
        tokens.forEach((token) => {
            const {
                name,
                chain_id,
                symbol,
                decimals,
                logo_path,
                price,
                price_24h_change,
                wallets_tokens: { amount },
            } = token;

            const tokenKey = `${name}-${chain_id}`;
            const normalizedAmount = Number(amount || 0);

            if (!tokenMap.has(tokenKey)) {
                tokenMap.set(tokenKey, {
                    chain_id,
                    name,
                    symbol,
                    decimals,
                    logo_path,
                    price: Number(price || 0),
                    price_24h_change: price_24h_change == null ? null : Number(price_24h_change),
                    amount: normalizedAmount,
                    wallets: new Map([
                        [
                            walletId,
                            {
                                tag,
                                id: walletId,
                                wallet: walletAddress,
                                amount: normalizedAmount,
                            },
                        ],
                    ]),
                });
                return;
            }

            const existingToken = tokenMap.get(tokenKey);
            existingToken.amount += normalizedAmount;

            if (existingToken.wallets.has(walletId)) {
                existingToken.wallets.get(walletId).amount += normalizedAmount;
            } else {
                existingToken.wallets.set(walletId, {
                    tag,
                    id: walletId,
                    wallet: walletAddress,
                    amount: normalizedAmount,
                });
            }
        });
    });

    return [...tokenMap.values()]
        .map((token) => ({
            ...token,
            wallets: [...token.wallets.values()],
            total_usd_value: token.amount * token.price,
        }))
        .filter((token) => token.total_usd_value > hideSmallBalances)
        .sort((a, b) => b.total_usd_value - a.total_usd_value);
};

export const getTokensForUser = async ({ chain, walletId, searchQuery, minimumUsdValue, userId }) => {
    const wallets = await fetchWalletTokenData({
        chain,
        minimumUsdValue,
        walletId,
        userId,
    });

    const tokens = await aggregateTokens(wallets);

    if (!searchQuery) {
        return tokens;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return tokens.filter((token) => token.symbol.toLowerCase().includes(normalizedQuery));
};
