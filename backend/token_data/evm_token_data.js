import fetchDebankData from "../utils/debank_api.js";
import {downloadLogo} from "../utils/download_logo.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";

const fetchAndSaveEvmTokenData = async (walletId, walletAddress) => {

    try {
        const tokens = await fetchDebankData('/user/all_token_list', {id: walletAddress, is_all: false})

        for (const token of tokens) {
            const {id, chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change} = token;

            const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;

            const [dbToken, created] = await TokenModel.upsert({
                chain_id: chain, name, symbol, decimals, logo_path: logoPath, price, price_24h_change
            }, {
                conflictFields: ['chain_id', 'symbol'], returning: true
            });

            const usd_value = amount * price;

            await WalletTokenModel.upsert({
                wallet_id: walletId, token_id: dbToken.id, amount, raw_amount, usd_value
            });
        }

        console.log(`Token data successfully saved/updated for wallet ID ${walletId}`);
    } catch (error) {
        console.error(`Error fetching or saving token data for wallet ID ${walletId}:`, error.message);
    }
};
export const fetchAndSaveEvmTokenDataForAllWallets = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: {chain: 'evm'}
        });

        for (const wallet of wallets) {
            await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet);
        }

        console.log('Token data for all wallets successfully updated');
    } catch (error) {
        console.error('Error fetching token data for all wallets:', error.message);
    }
};