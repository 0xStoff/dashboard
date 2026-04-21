import fetchDebankData from "../utils/debank_api.js";
import { downloadLogo } from "../utils/download_logo.js";
import WalletModel from "../models/WalletModel.js";
import ProtocolModel from "../models/ProtocolModel.js";
import WalletProtocolModel from "../models/WalletProtocolModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";

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

export const fetchAndSaveEvmTokenData = async (walletId, walletAddress, req) => {
    try {
        const userId = req.user.user.id;
        const tokens = await fetchDebankData("/user/all_token_list", {
            id: walletAddress,
            is_all: false,
        });

        const retainedTokenIds = [];

        for (const token of tokens) {
            const { id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;

            const existingToken = await TokenModel.findOne({
                where: { chain_id: chain, symbol },
            });

            const logoPath = existingToken?.logo_path || (logo_url ? await downloadLogo(logo_url, id) : null);

            const [dbToken] = await TokenModel.upsert(
                {
                    chain_id: chain,
                    name,
                    symbol,
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

            await WalletTokenModel.upsert({
                user_id: userId,
                wallet_id: walletId,
                token_id: dbToken.id,
                amount,
                raw_amount,
                usd_value,
            });
        }

        const protocols = await fetchDebankData("/user/all_complex_protocol_list", {
            id: walletAddress,
        });

        const retainedProtocolIds = [];

        for (const protocol of protocols) {
            const { id, chain, name, logo_url, portfolio_item_list } = protocol;

            const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

            const [dbProtocol] = await ProtocolModel.upsert({
                    chain_id: chain,
                    name,
                    logo_path: logoPath,
                }
                , {
                    conflictFields: ["chain_id", "name"]
                }
            );
            retainedProtocolIds.push(dbProtocol.id);

            await WalletProtocolModel.upsert({
                user_id: userId,
                wallet_id: walletId, protocol_id: dbProtocol.id, portfolio_item_list
            }, {
                conflictFields: ["wallet_id", "protocol_id"]
            });
        }

        await deleteMissingWalletRows({
            model: WalletTokenModel,
            walletId,
            userId,
            key: "token_id",
            retainedIds: retainedTokenIds,
        });

        await deleteMissingWalletRows({
            model: WalletProtocolModel,
            walletId,
            userId,
            key: "protocol_id",
            retainedIds: retainedProtocolIds,
        });

        console.log('Token and protocol data successfully saved/updated for an EVM wallet');
    } catch (error) {
        console.error('Error fetching or saving EVM wallet data:', error.message);
    }
};

export const fetchAndSaveEvmTokenDataForAllWallets = async (req) => {
    try {
        const wallets = await WalletModel.findAll({
            order: [["id", "ASC"]], where: { chain: "evm" }
        });


        for (const wallet of wallets) {
            await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, req);
        }

        console.log('Token and protocol data for all EVM wallets successfully updated');
    } catch (error) {
        console.error("Error fetching data for all wallets:", error.message);
    }
};
