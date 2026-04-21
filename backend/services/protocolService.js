import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";
import { getHideSmallBalances } from "./settingsService.js";

const getPortfolioItems = (wallet) => {
    const items = wallet?.portfolio_item_list;
    return Array.isArray(items) ? items : [];
};

const getAssetTokenList = (item) => {
    const tokens = item?.detail?.supply_token_list;
    return Array.isArray(tokens) ? tokens : [];
};

const getSupplyTokenAmount = (item) => Number(item?.detail?.supply_token_list?.[0]?.amount || 0);

const createProtocolAccumulator = (name) => ({
    name,
    positions: [],
    totalUSD: 0,
});

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
        unified[key].wallets = [...unified[key].wallets, ...position.wallets];
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
    selectedChainId,
    item,
}) => {
    const validTokens = tokens
        .filter((token) => selectedChainId === "all" || token.chain === selectedChainId)
        .filter((token) => Number(token.amount || 0) * Number(token.price || 0) > 0.01 || Number(item?.stats?.asset_usd_value || 0) > 0.01);

    if (!validTokens.length) {
        return;
    }

    const tokenNames = validTokens.map((token) => token.name).join(" + ");
    const logoUrls = validTokens.map((token) => token.logo_url).filter(Boolean);
    const totalAmount = validTokens.reduce((sum, token) => sum + Number(token.amount || 0), 0);
    const totalUsdValue = Number(item?.stats?.asset_usd_value || 0);
    const averagePrice = totalAmount > 0 ? totalUsdValue / totalAmount : 0;

    const existingPosition = acc[protocolName].positions.find(
        (position) =>
            position.tokenNames === tokenNames &&
            position.chain === validTokens[0].chain &&
            position.type === itemName
    );

    if (existingPosition) {
        if (walletTag && walletAmount !== undefined) {
            const walletExists = existingPosition.wallets.some((wallet) => wallet.tag === walletTag);
            if (!walletExists) {
                existingPosition.wallets.push({ tag: walletTag, amount: walletAmount });
            }
        }
    } else {
        acc[protocolName].positions.push({
            type: itemName,
            chain: validTokens[0].chain,
            tokenNames,
            logoUrls,
            price: averagePrice,
            amount: totalAmount,
            usdValue: totalUsdValue,
            wallets: walletTag && walletAmount !== undefined ? [{ tag: walletTag, amount: walletAmount }] : [],
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
                        walletAmount: getSupplyTokenAmount(item),
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
