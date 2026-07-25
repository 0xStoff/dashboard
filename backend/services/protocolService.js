import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";
import { getHideSmallBalances } from "./settingsService.js";

const getPortfolioItems = (wallet) => {
    const items = wallet?.portfolio_item_list;
    return Array.isArray(items) ? items : [];
};

const getAssetTokenList = (item) => {
    const detail = item?.detail || {};
    const candidates = [
        ...(Array.isArray(detail.supply_token_list) ? detail.supply_token_list : []),
        ...(Array.isArray(detail.reward_token_list) ? detail.reward_token_list : []),
        ...(detail.token ? [detail.token] : []),
    ];
    const tokens = new Map();

    candidates.forEach((token) => {
        const key = `${token.chain || ""}-${token.id || token.symbol || token.name || "unknown"}`;
        const existing = tokens.get(key);
        if (existing) {
            existing.amount += Number(token.amount || 0);
        } else {
            tokens.set(key, { ...token, amount: Number(token.amount || 0) });
        }
    });
    return [...tokens.values()];
};
const getPositionUsdValue = (item) => {
    const rawNetValue = item?.stats?.net_usd_value;
    const netValue = rawNetValue == null ? Number.NaN : Number(rawNetValue);
    if (Number.isFinite(netValue)) return netValue;
    return Number(item?.stats?.asset_usd_value || 0);
};

const createProtocolAccumulator = (name) => ({
    name,
    positions: [],
    totalUSD: 0,
});

const mergeWalletAmount = (wallets, walletTag, walletAmount, walletUsdValue) => {
    if (!walletTag || walletAmount === undefined) {
        return;
    }

    const existingWallet = wallets.find((wallet) => wallet.tag === walletTag);
    if (existingWallet) {
        existingWallet.amount += Number(walletAmount || 0);
        existingWallet.usdValue += Number(walletUsdValue || 0);
        return;
    }

    wallets.push({
        tag: walletTag,
        amount: Number(walletAmount || 0),
        usdValue: Number(walletUsdValue || 0),
    });
};

const unifyPositions = (positions) => {
    const unified = {};

    positions.forEach((position) => {
        const key = `${position.tokenNames}-${position.type}-${position.chain}`;
        if (!unified[key]) {
            unified[key] = { ...position, wallets: [...position.wallets] };
            return;
        }

        unified[key].amount += position.amount;
        unified[key].usdValue += position.usdValue;
        position.wallets.forEach((wallet) => {
            mergeWalletAmount(unified[key].wallets, wallet.tag, wallet.amount, wallet.usdValue);
        });
        unified[key].price = unified[key].tokenCount === 1 ? position.price : 0;
    });

    return Object.values(unified).sort((a, b) => b.usdValue - a.usdValue);
};

const addPosition = ({
    protocolName,
    acc,
    tokens,
    itemName,
    walletTag,
    walletAmount,
    walletUsdValue,
    selectedChainId,
    item,
}) => {
    const validTokens = tokens
        .filter((token) => selectedChainId === "all" || token.chain === selectedChainId)
        .filter((token) => Number(token.amount || 0) * Number(token.price || 0) > 0.01 || walletUsdValue > 0.01);

    if (!validTokens.length) {
        return;
    }

    const tokenNames = validTokens.map((token) => token.name).join(" + ");
    const logoUrls = validTokens.map((token) => token.logo_url).filter(Boolean);
    const totalAmount = validTokens.reduce((sum, token) => sum + Number(token.amount || 0), 0);
    const totalUsdValue = walletUsdValue;
    const displayPrice = validTokens.length === 1 ? Number(validTokens[0].price || 0) : 0;

    const existingPosition = acc[protocolName].positions.find(
        (position) =>
            position.tokenNames === tokenNames &&
            position.chain === validTokens[0].chain &&
            position.type === itemName
    );

    if (existingPosition) {
        existingPosition.amount += totalAmount;
        existingPosition.usdValue += totalUsdValue;
        existingPosition.price = existingPosition.tokenCount === 1 ? displayPrice : 0;
        mergeWalletAmount(existingPosition.wallets, walletTag, totalAmount, walletUsdValue);
    } else {
        acc[protocolName].positions.push({
            type: itemName,
            chain: validTokens[0].chain,
            tokenNames,
            logoUrls,
            price: displayPrice,
            amount: totalAmount,
            usdValue: totalUsdValue,
            tokenCount: validTokens.length,
            wallets: walletTag && walletAmount !== undefined
                ? [{ tag: walletTag, amount: totalAmount, usdValue: walletUsdValue }]
                : [],
        });
    }

    acc[protocolName].totalUSD += totalUsdValue;
};

export const fetchProtocolData = async (userId) => {
    const protocols = await ProtocolModel.findAll({
        include: [
            {
                model: WalletModel,
                attributes: ["id", "wallet", "tag", "chain", "user_id"],
                where: { user_id: userId },
            },
        ],
        order: [["id", "ASC"]],
    });

    return protocols.map((protocol) => {
        const protocolData = protocol.get();
        const walletSet = new Map();

        protocolData.wallets.forEach((wallet) => {
            const key = `${wallet.id}-${wallet.wallet}`;
            if (!walletSet.has(key)) {
                walletSet.set(key, {
                    tag: wallet.tag,
                    id: wallet.id,
                    wallet: wallet.wallet,
                    chain: wallet.chain,
                    amount: wallet.amount || 0,
                    portfolio_item_list: wallet.wallets_protocols?.portfolio_item_list || [],
                });
            }
        });

        return {
            ...protocolData,
            user_id: userId,
            wallets: [...walletSet.values()],
        };
    });
};

export const getProtocolsTable = async ({ chain, walletId, searchQuery, userId }) => {
    const hideSmallBalances = await getHideSmallBalances();
    const protocolData = await fetchProtocolData(userId);

    const groupedByProtocol = protocolData.reduce((acc, protocol) => {
        if (!acc[protocol.name]) {
            acc[protocol.name] = createProtocolAccumulator(protocol.name);
        }

        protocol.wallets
            .filter((wallet) => walletId === "all" || wallet.id === Number(walletId))
            .forEach((wallet) => {
                getPortfolioItems(wallet).forEach((item) => {
                    addPosition({
                        protocolName: protocol.name,
                        acc,
                        tokens: getAssetTokenList(item),
                        itemName: item.name,
                        walletTag: wallet.tag,
                        walletAmount: getAssetTokenList(item).reduce(
                            (sum, token) => sum + Number(token.amount || 0),
                            0
                        ),
                        walletUsdValue: getPositionUsdValue(item),
                        selectedChainId: chain,
                        item,
                    });
                });
            });

        return acc;
    }, {});

    let protocols = Object.values(groupedByProtocol)
        .map((protocol) => ({
            ...protocol,
            positions: unifyPositions(protocol.positions),
        }))
        .filter((protocol) => protocol.totalUSD > hideSmallBalances)
        .sort((a, b) => b.totalUSD - a.totalUSD);

    if (!searchQuery) {
        return protocols;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return protocols
        .map((protocol) => {
            const matchingPositions = protocol.positions.filter((position) =>
                position.tokenNames.toLowerCase().includes(normalizedQuery)
            );

            if (!matchingPositions.length) {
                return null;
            }

            return {
                ...protocol,
                positions: matchingPositions,
                totalUSD: matchingPositions.reduce((sum, position) => sum + position.usdValue, 0),
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.totalUSD - a.totalUSD);
};
