// Fetch and save Solana token data
import {nonEvmChains} from "../utils/chainlist.js";
import {Connection, PublicKey} from "@solana/web3.js";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import fetchTokenPrice from "../utils/coingecko_api.js";
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import {downloadLogo} from "../utils/download_logo.js";
import TokenModel from "../models/TokenModel.js";
import WalletTokenModel from "../models/WalletTokenModel.js";
import WalletModel from "../models/WalletModel.js";

export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const solMetaData = nonEvmChains.find(chain => chain.id === 'sol')

    const connection = new Connection(solMetaData.endpoint);
    const owner = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {programId: TOKEN_PROGRAM_ID});
    const balance = await connection.getBalance(owner);

    const solPrice = await fetchTokenPrice('solana') || {usd: 0};

    let tokenData = [{
        amount: balance / 10 ** 9,
        usd: solPrice.usd,
        price_24h_change: solPrice.usd_24h_change,
        ...nonEvmChains.find(chain => chain.id === 'sol')
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
            console.log(tokenPrice)
            if (tokenPrice) {
                tokenData.push({
                    ...tokenInfo, amount: parsedAccountInfo.tokenAmount.uiAmount, usd: tokenPrice.usd, price_24h_change: tokenPrice.usd_24h_change
                });
            }
        }
    }

    tokenData = tokenData.filter(token => token.amount > 0);

    for (const token of tokenData) {
        const {name, symbol, decimals, logoURI, amount, usd, price_24h_change} = token;

        // const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;


        const [dbToken] = await TokenModel.upsert({
            chain_id: 'sol', name, symbol, decimals, logo_path: logoURI, price: usd, price_24h_change
        }, {conflictFields: ['chain_id', 'symbol'], returning: true});


        const raw_amount = amount * 10 ** decimals;
        const usd_value = amount * usd;

        await WalletTokenModel.upsert({
            wallet_id: walletId, token_id: dbToken.id, amount, raw_amount, usd_value
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