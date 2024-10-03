import axios from "axios";
import {downloadLogo} from "./download_logo.js";
import {pool} from "../db.js";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {Connection, PublicKey} from "@solana/web3.js";
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import WalletModel from "../models/WalletModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import TokenModel from "../models/TokenModel.js";
import fetchDebankData from "./debank_api.js";
import fetchTokenPrice from "./coingecko_api.js";
import {nonEvmChains} from "./chainlist.js";

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

            await WalletTokenModel.upsert({
                wallet_id: walletId, token_id: dbToken.id, amount, raw_amount
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


const connectSolAndRaydium = () => {

}
// Fetch and save Solana token data
export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const solMetaData = nonEvmChains.find(chain => chain.id === 'sol')

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {programId: TOKEN_PROGRAM_ID});
    const balance = await connection.getBalance(owner);

    const solPrice = await fetchTokenPrice('solana') || {usd: 0};

    let tokenData = [{
        amount: balance / 10 ** 9, usd: solPrice.usd, ...nonEvmChains.find(chain => chain.id === 'sol')
    }];

    const raydium = await Raydium.load({
        connection, owner, disableLoadToken: false
    });

    for (const accountInfo of tokenAccounts.value) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint;

        const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);

        if (tokenInfo) {
            const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
            if (tokenPrice) {
                tokenData.push({
                    ...tokenInfo, amount: parsedAccountInfo.tokenAmount.uiAmount, usd: tokenPrice.usd
                });
            }
        }
    }

    tokenData = tokenData.filter(token => token.amount > 0);

    for (const token of tokenData) {
        const {name, symbol, decimals, logoURI, amount, usd} = token;

        const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;

        const [dbToken] = await TokenModel.upsert({
            chain_id: 'sol', name, symbol, decimals, logo_path: logoPath, price: usd,
        }, { conflictFields: ['chain_id', 'symbol'], returning: true});


        const raw_amount = amount * 10 ** decimals;

        await WalletTokenModel.upsert({
            wallet_id: walletId, token_id: dbToken.id, amount, raw_amount,
        });
    }

    console.log(`Token data successfully saved/updated for Solana wallet ID ${walletId}`);
};

export const fetchAndSaveSolTokenDataForAllWallets = async () => {
    try {
        const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']], where: {chain: 'sol'}
        });
        for (const wallet of wallets) {
            await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
        }

        console.log('Token data for all Solana wallets successfully updated');
    } catch (error) {
        console.error('Error fetching Solana token data for all wallets:', error.message);
    }
};
