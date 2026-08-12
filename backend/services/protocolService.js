import ProtocolModel from "../models/ProtocolModel.js";
import WalletModel from "../models/WalletModel.js";
import { normalizeContractAddress } from "../utils/tokenAddress.js";
import { getCanonicalTokenLogo } from "../utils/token_logo.js";
import { getProtocolPositionAssets, getProtocolPositionValuation } from "./valuationService.js";

const getPortfolioItems = (wallet) => {
    const items = wallet?.portfolio_item_list;
    return Array.isArray(items) ? items : [];
};

const getAssetTokenList = (item) => {
    const detail = item?.detail || {};
    const candidates = [
        ...getProtocolPositionAssets(item),
        ...(Array.isArray(detail.reward_token_list) ? detail.reward_token_list : []),
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

const createProtocolAccumulator = (name) => ({
    name,
    positions: [],
    totalUSD: 0,
});

const mergeContractAddresses = (existing = [], next = []) =>
    [...new Set([...(existing || []), ...(next || [])].filter(Boolean))];

const mergeAssetAmounts = (existing = [], next = []) => {
    const assets = new Map();
    [...existing, ...next].forEach((asset) => {
        const key = `${asset.symbol || asset.name}-${asset.contract || ""}`;
        const current = assets.get(key) || { ...asset, amount: 0, usdValue: 0 };
        current.amount += Number(asset.amount || 0);
        current.usdValue += Number(asset.usdValue || 0);
        if (current.amount > 0 && current.usdValue > 0) {
            current.price = current.usdValue / current.amount;
        }
        if (current.pricingMethod !== asset.pricingMethod) {
            current.pricingMethod = "mixed";
        }
        assets.set(key, current);
    });
    return [...assets.values()];
};

const mergePositionValuation = (existing, next) => {
    if (!existing) return next;
    if (!next || existing.method === next.method) return existing;
    return {
        method: "mixed",
        confidence: "estimated",
        source: "multiple valuation methods across merged positions",
        inferredAssetPrices: [
            ...(existing.inferredAssetPrices || []),
            ...(next.inferredAssetPrices || []),
        ],
    };
};

const mergeWalletAmount = (wallets, walletId, walletTag, walletAmount, walletUsdValue) => {
    if ((!walletId && !walletTag) || walletAmount === undefined) {
        return;
    }

    // Tags are user-editable labels. Keep the immutable wallet ID alongside the
    // display label so two wallets with the same tag do not silently merge.
    const existingWallet = wallets.find((wallet) =>
        walletId != null ? wallet.id === walletId : wallet.tag === walletTag
    );
    if (existingWallet) {
        existingWallet.amount += Number(walletAmount || 0);
        existingWallet.usdValue += Number(walletUsdValue || 0);
        return;
    }

    wallets.push({
        id: walletId ?? null,
        tag: walletTag,
        amount: Number(walletAmount || 0),
        usdValue: Number(walletUsdValue || 0),
    });
};

const positionIdentity = ({ protocolName, item, itemName, chain, contractAddresses }) => {
    const detail = item?.detail || {};
    const explicitId = [
        item?.id,
        item?.position_id,
        detail?.id,
        detail?.position_id,
        detail?.pool?.id,
        detail?.pool?.address,
        detail?.contract_address,
        item?.contract_address,
    ].find(Boolean);
    const assetIdentity = [...(contractAddresses || [])].filter(Boolean).sort().join("|");
    return `${protocolName}|${chain || "unknown"}|${itemName || "position"}|${explicitId || assetIdentity || "unknown"}`;
};

const unifyPositions = (positions) => {
    const unified = {};

    positions.forEach((position) => {
        const key = position.positionKey || `${position.tokenNames}-${position.tokenSymbols || ""}-${position.type}-${position.chain}`;
        if (!unified[key]) {
            unified[key] = { ...position, wallets: [...position.wallets] };
            return;
        }

        unified[key].amount += position.amount;
        unified[key].usdValue += position.usdValue;
        position.wallets.forEach((wallet) => {
            mergeWalletAmount(unified[key].wallets, wallet.id, wallet.tag, wallet.amount, wallet.usdValue);
        });
        unified[key].price = unified[key].tokenCount === 1 ? position.price : 0;
        unified[key].contractAddresses = mergeContractAddresses(
            unified[key].contractAddresses,
            position.contractAddresses
        );
        unified[key].assetAmounts = mergeAssetAmounts(unified[key].assetAmounts, position.assetAmounts);
    });

    return Object.values(unified).sort((a, b) => b.usdValue - a.usdValue);
};

const addPosition = ({
    protocolName,
    acc,
    tokens,
    itemName,
    walletTag,
    walletId,
    walletAmount,
    walletUsdValue,
    valuation,
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
    const tokenSymbols = validTokens.map((token) => token.symbol || token.name).join(" + ");
    const contractAddresses = mergeContractAddresses(
        [],
        validTokens.map((token) => normalizeContractAddress(token.chain, token.id || token.address || null))
    );
    const positionKey = positionIdentity({
        protocolName,
        item,
        itemName,
        chain: validTokens[0]?.chain,
        contractAddresses,
    });
    const impliedPrices = new Map(
        (valuation?.pricing?.inferredAssetPrices || []).map((entry) => [entry.contract, Number(entry.priceUsd || 0)])
    );
    const assetAmounts = validTokens.map((token) => {
        const contract = normalizeContractAddress(token.chain, token.id || token.address || null);
        const providerPrice = Number(token.price || 0);
        const impliedPrice = Number(impliedPrices.get(contract) || 0);
        const price = providerPrice > 0 ? providerPrice : impliedPrice;
        const logoPath = getCanonicalTokenLogo(token.symbol || token.name) || token.logo_url || null;
        return {
            contract,
            symbol: token.symbol || token.name || "Unknown",
            name: token.name || token.symbol || "Unknown",
            amount: Number(token.amount || 0),
            price,
            usdValue: Number(token.amount || 0) * price,
            pricingMethod: providerPrice > 0 ? "provider" : impliedPrice > 0 ? "pool-implied" : "unavailable",
            logoPath,
        };
    });
    // Prefer our canonical local assets, then use the token image supplied by
    // the same portfolio provider that supplied the position payload.
    const logoUrls = validTokens.map((token) =>
        getCanonicalTokenLogo(token.symbol || token.name) || token.logo_url || ""
    );
    const totalAmount = validTokens.reduce((sum, token) => sum + Number(token.amount || 0), 0);
    const totalUsdValue = walletUsdValue;
    const displayPrice = validTokens.length === 1 ? Number(validTokens[0].price || 0) : 0;

    const existingPosition = acc[protocolName].positions.find(
        (position) =>
            position.positionKey === positionKey
    );

    if (existingPosition) {
        existingPosition.amount += totalAmount;
        existingPosition.usdValue += totalUsdValue;
        existingPosition.price = existingPosition.tokenCount === 1 ? displayPrice : 0;
        existingPosition.contractAddresses = mergeContractAddresses(
            existingPosition.contractAddresses,
            contractAddresses
        );
        existingPosition.assetAmounts = mergeAssetAmounts(existingPosition.assetAmounts, assetAmounts);
        existingPosition.logoUrls = existingPosition.logoUrls.map((url, index) => url || logoUrls[index] || "");
        existingPosition.valuation = mergePositionValuation(existingPosition.valuation, valuation?.pricing);
        mergeWalletAmount(existingPosition.wallets, walletId, walletTag, totalAmount, walletUsdValue);
    } else {
        acc[protocolName].positions.push({
            positionKey,
            type: itemName,
            chain: validTokens[0].chain,
            tokenNames,
            tokenSymbols,
            contractAddresses,
            assetAmounts,
            logoUrls,
            price: displayPrice,
            amount: totalAmount,
            usdValue: totalUsdValue,
            tokenCount: validTokens.length,
            valuation: valuation?.pricing,
            wallets: walletTag && walletAmount !== undefined
                ? [{ id: walletId ?? null, tag: walletTag, amount: totalAmount, usdValue: walletUsdValue }]
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
    const protocolData = await fetchProtocolData(userId);

    const groupedByProtocol = protocolData.reduce((acc, protocol) => {
        if (!acc[protocol.name]) {
            acc[protocol.name] = createProtocolAccumulator(protocol.name);
        }

        protocol.wallets
            .filter((wallet) => walletId === "all" || wallet.id === Number(walletId))
            .forEach((wallet) => {
                getPortfolioItems(wallet).forEach((item) => {
                    const valuation = getProtocolPositionValuation(item);
                    addPosition({
                        protocolName: protocol.name,
                        acc,
                        tokens: getAssetTokenList(item),
                        itemName: item.name,
                        walletId: wallet.id,
                        walletTag: wallet.tag,
                        walletAmount: getAssetTokenList(item).reduce(
                            (sum, token) => sum + Number(token.amount || 0),
                            0
                        ),
                        walletUsdValue: valuation.usdValue,
                        valuation,
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
        .filter((protocol) => protocol.totalUSD > 0)
        .sort((a, b) => b.totalUSD - a.totalUSD);

    if (!searchQuery) {
        return protocols;
    }

    const normalizedQuery = searchQuery.toLowerCase();
    return protocols
        .map((protocol) => {
            if (protocol.name.toLowerCase().includes(normalizedQuery)) {
                return protocol;
            }
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
