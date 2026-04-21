import { Op } from "sequelize";
import EvmChains from "../models/EvmChainsModel.js";
import NonEvmChains from "../models/NonEvmChainsModel.js";
import WalletModel from "../models/WalletModel.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import { getHideSmallBalances } from "./settingsService.js";
import { SUPPORTED_TRACKED_WALLET_CHAINS } from "../config/supportedChains.js";

const createChainSummary = (chainId) => ({
    chain_id: chainId,
    total_usd_value: 0,
    total_token_usd_value: 0,
    total_protocol_usd_value: 0,
});

const ensureChainSummary = (summaryByChain, chainId) => {
    if (!summaryByChain[chainId]) {
        summaryByChain[chainId] = createChainSummary(chainId);
    }

    return summaryByChain[chainId];
};

const getPortfolioItems = (protocol) => {
    const items = protocol?.wallets_protocols?.portfolio_item_list;
    return Array.isArray(items) ? items : [];
};

const getAssetTokenList = (item) => {
    const tokens = item?.asset_token_list;
    return Array.isArray(tokens) ? tokens : [];
};

export const getAvailableChains = async () => {
    const [evmChains, nonEvmChains] = await Promise.all([
        EvmChains.findAll({ order: [["chain_id", "ASC"]] }),
        NonEvmChains.findAll({ order: [["chain_id", "ASC"]] }),
    ]);

    return [
        ...evmChains.map((chain) => ({ ...chain.dataValues, type: "evm" })),
        ...nonEvmChains.map((chain) => ({ ...chain.dataValues, type: "non-evm" })),
    ];
};

export const getWalletChainSummary = async ({ walletId, searchQuery, userId }) => {
    const walletWhereClause =
        walletId !== "all"
            ? { id: walletId, user_id: userId, chain: { [Op.in]: SUPPORTED_TRACKED_WALLET_CHAINS } }
            : { user_id: userId, chain: { [Op.in]: SUPPORTED_TRACKED_WALLET_CHAINS } };
    const normalizedQuery = searchQuery?.toLowerCase() || "";

    const wallets = await WalletModel.findAll({
        where: walletWhereClause,
        include: [
            {
                model: TokenModel,
                through: { model: WalletTokenModel, attributes: ["amount", "raw_amount", "usd_value"] },
                attributes: ["name", "symbol", "decimals", "price", "logo_path", "chain_id"],
            },
            {
                model: ProtocolModel,
                through: { model: WalletProtocolModel, attributes: ["portfolio_item_list"] },
                attributes: ["name", "logo_path", "chain_id"],
            },
        ],
        order: [["id", "ASC"]],
    });

    const summaryByChain = {};

    wallets.forEach((wallet) => {
        const tokens = wallet.tokens.map((token) => ({
            ...token.get(),
            usd_value: Number(token.wallets_tokens.usd_value || 0),
        }));

        const filteredTokens = normalizedQuery
            ? tokens.filter((token) => token.symbol.toLowerCase().includes(normalizedQuery))
            : tokens;

        filteredTokens.forEach((token) => {
            const summary = ensureChainSummary(summaryByChain, token.chain_id);
            summary.total_usd_value += token.usd_value;
            summary.total_token_usd_value += token.usd_value;
        });

        wallet.protocols.forEach((protocol) => {
            const filteredItems = getPortfolioItems(protocol).filter((item) =>
                !normalizedQuery ||
                getAssetTokenList(item).some((token) => token.name?.toLowerCase?.().includes(normalizedQuery))
            );

            const protocolUsdValue = filteredItems.reduce(
                (sum, item) => sum + Number(item?.stats?.asset_usd_value || 0),
                0
            );

            if (protocolUsdValue <= 0) {
                return;
            }

            const summary = ensureChainSummary(summaryByChain, protocol.chain_id);
            summary.total_usd_value += protocolUsdValue;
            summary.total_protocol_usd_value += protocolUsdValue;
        });
    });

    return summaryByChain;
};

export const getEnrichedChains = async ({ walletId, searchQuery, userId }) => {
    const [chains, summaryByChain, hideSmallBalances] = await Promise.all([
        getAvailableChains(),
        getWalletChainSummary({ walletId, searchQuery, userId }),
        getHideSmallBalances(),
    ]);

    return chains
        .map((chain) => {
            const summary = summaryByChain[chain.chain_id] || createChainSummary(chain.chain_id);

            return {
                id: chain.id,
                chain_id: chain.chain_id,
                name: chain.name,
                native_token_id: chain.native_token_id,
                wrapped_token_id: chain.wrapped_token_id,
                logo_path: chain.logo_path,
                type: chain.type,
                usd_value: Number(summary.total_usd_value.toFixed(2)),
                token_usd_value: Number(summary.total_token_usd_value.toFixed(2)),
                protocol_usd_value: Number(summary.total_protocol_usd_value.toFixed(2)),
            };
        })
        .filter((chain) => chain.usd_value > hideSmallBalances)
        .sort((a, b) => b.usd_value - a.usd_value);
};
