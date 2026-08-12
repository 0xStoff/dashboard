import fetchDebankData from "../utils/debank_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import { getCanonicalTokenLogo } from "../utils/token_logo.js";

const TOKEN_CACHE_MS = 2 * 60 * 1000;
const PROTOCOL_CACHE_MS = 6 * 60 * 60 * 1000;
// Hyperliquid spot balances are stored separately because DeBank does not
// expose them. A DeBank refresh must not delete rows owned by that importer.
const EXTERNALLY_MANAGED_TOKEN_CHAINS = ["hyperliquid"];

const deleteMissingWalletRows = async ({ model, walletId, userId, key, retainedIds }) => {
    const rows = await model.findAll({ where: { wallet_id: walletId, user_id: userId } });
    const staleRows = rows.filter((row) => !retainedIds.includes(row[key]));

    if (!staleRows.length) {
        return;
    }

    await model.destroy({
        where: {
            wallet_id: walletId,
            user_id: userId,
            [key]: staleRows.map((row) => row[key]),
        },
    });
};

export const fetchAndSaveEvmProtocolData = async (
    walletId,
    walletAddress,
    userId,
    { force = false } = {}
) => {
    const protocols = await fetchDebankData("/user/all_complex_protocol_list", {
        id: walletAddress,
    }, { ttlMs: PROTOCOL_CACHE_MS, force });
    const retainedProtocolIds = [];

    for (const protocol of protocols) {
        const { id, chain, name, logo_url, portfolio_item_list } = protocol;
        const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;
        const [dbProtocol] = await ProtocolModel.upsert({
            chain_id: chain,
            name,
            logo_path: logoPath,
        }, { conflictFields: ["chain_id", "name"] });
        retainedProtocolIds.push(dbProtocol.id);

        await WalletProtocolModel.upsert({
            user_id: userId,
            wallet_id: walletId,
            protocol_id: dbProtocol.id,
            portfolio_item_list,
        }, { conflictFields: ["wallet_id", "protocol_id"] });
    }

    await deleteMissingWalletRows({
        model: WalletProtocolModel,
        walletId,
        userId,
        key: "protocol_id",
        retainedIds: retainedProtocolIds,
    });
    return { protocolsUpdated: retainedProtocolIds.length };
};

export const fetchAndSaveEvmTokenData = async (walletId, walletAddress, req, options = {}) => {
        const userId = req.user.user.id;
        const tokens = await fetchDebankData("/user/all_token_list", {
            id: walletAddress,
            is_all: false,
        }, { ttlMs: TOKEN_CACHE_MS, force: options.forceTokens === true });

        const retainedTokenIds = [];

        for (const token of tokens) {
            const { id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;

            const existingToken = await TokenModel.findOne({
                where: { chain_id: chain, symbol },
            });

            const downloadedLogoPath = logo_url ? await downloadLogo(logo_url, id) : null;
            const logoPath = getCanonicalTokenLogo(symbol) || downloadedLogoPath || existingToken?.logo_path || null;

            const [dbToken] = await TokenModel.upsert(
                {
                    chain_id: chain,
                    name,
                    symbol,
                    contract_address: id,
                    decimals,
                    logo_path: logoPath,
                    price,
                    price_24h_change: price_24h_change * 100,
                }
                ,
                {
                    conflictFields: ["chain_id", "symbol"],
                }
            );

            const usd_value = amount * price;
            retainedTokenIds.push(dbToken.id);

            await WalletTokenModel.upsert(
                {
                    user_id: userId,
                    wallet_id: walletId,
                    token_id: dbToken.id,
                    amount,
                    raw_amount,
                    usd_value,
                },
                { conflictFields: ["wallet_id", "token_id"] }
            );
        }

        await fetchAndSaveEvmProtocolData(walletId, walletAddress, userId, {
            force: options.forceTokens === true,
        });

        const externallyManagedTokens = await TokenModel.findAll({
            where: { chain_id: EXTERNALLY_MANAGED_TOKEN_CHAINS },
            attributes: ["id"],
        });

        await deleteMissingWalletRows({
            model: WalletTokenModel,
            walletId,
            userId,
            key: "token_id",
            retainedIds: [
                ...retainedTokenIds,
                ...externallyManagedTokens.map((token) => token.id),
            ],
        });

        console.log('Token and protocol data successfully saved/updated for an EVM wallet');
};

export const fetchAndSaveEvmTokenDataForAllWallets = async (req) => {
        const userId = req.user?.user?.id;
        if (!userId) throw new Error("Missing authenticated user ID");
        const wallets = await WalletModel.findAll({
            order: [["id", "ASC"]], where: { chain: "evm", user_id: userId }
        });


        for (const wallet of wallets) {
            await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, req, { forceTokens: true });
        }

        console.log('Token and protocol data for all EVM wallets successfully updated');
        return { walletsUpdated: wallets.length };
};
