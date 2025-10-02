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

// // Fetch and save Solana token data
// import {nonEvmChains} from "../utils/chainlist.js";
// import {Connection, PublicKey} from "@solana/web3.js";
// import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
// import fetchTokenPrice from "../utils/coingecko_api.js";
// import {Raydium} from "@raydium-io/raydium-sdk-v2";
// import {downloadLogo} from "../utils/download_logo.js";
// import TokenModel from "../models/TokenModel.js";
// import WalletTokenModel from "../models/WalletTokenModel.js";
// import WalletModel from "../models/WalletModel.js";
//
// export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
//     const solMetaData = nonEvmChains.find(chain => chain.id === 'sol')
//
//     const connection = new Connection(solMetaData.endpoint);
//     const owner = new PublicKey(walletAddress);
//
//     const pumpAccount = await connection.getParsedTokenAccountsByOwner(owner, {
//         mint: new PublicKey("pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn"),
//         programId: TOKEN_PROGRAM_ID
//     });
//     const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {programId: TOKEN_PROGRAM_ID});
//     if (pumpAccount.value.length > 0) {
//         const pumpMint = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
//         const alreadyIncluded = tokenAccounts.value.some(acc => acc.account.data.parsed.info.mint === pumpMint);
//         if (!alreadyIncluded) {
//             for (const pumpAcc of pumpAccount.value) {
//                 tokenAccounts.value.push({
//                     pubkey: pumpAcc.pubkey,
//                     account: {
//                         data: {
//                             parsed: pumpAcc.account.data.parsed
//                         }
//                     }
//                 });
//             }
//         }
//     }
//     const balance = await connection.getBalance(owner);
//     const solPrice = await fetchTokenPrice('solana') || {usd: 0};
//
//
//
//
//     let tokenData = [{
//         amount: balance / 10 ** 9,
//         usd: solPrice.usd,
//         price_24h_change: solPrice.usd_24h_change,
//         logoURI: "SOL.png",
//         ...nonEvmChains.find(chain => chain.id === 'sol')
//     }];
//
//     const raydium = await Raydium.load({
//         connection, owner, disableLoadToken: false
//     });
//
//     for (const accountInfo of tokenAccounts.value) {
//         const parsedAccountInfo = accountInfo.account.data.parsed.info;
//         const tokenAddress = parsedAccountInfo.mint;
//
//         const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);
//
//         if (tokenInfo) {
//             let coingeckoId = tokenInfo.extensions.coingeckoId;
//            if(tokenInfo.symbol === "PENGU") coingeckoId = 'pudgy-penguins';
//             const tokenPrice = await fetchTokenPrice(coingeckoId || '');
//
//             if (tokenPrice) {
//                 tokenData.push({
//                     ...tokenInfo,
//                     amount: parsedAccountInfo.tokenAmount.uiAmount,
//                     usd: tokenPrice.usd,
//                     price_24h_change: tokenPrice.usd_24h_change
//                 });
//             }
//         }
//         else if (tokenAddress === "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn") {
//             const tokenPrice = await fetchTokenPrice("pump-fun");
//             tokenData.push({
//                 symbol: "PUMP",
//                 name: "Pump",
//                 logoURI: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36507.png',
//                 decimals: 9,
//                 address: tokenAddress,
//                 amount: parsedAccountInfo.tokenAmount.uiAmount,
//                 usd: tokenPrice?.usd || 0,
//                 price_24h_change: tokenPrice?.usd_24h_change || 0
//             });
//         }
//         const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
//         await delay(500);
//     }
//
//     tokenData = tokenData.filter(token => token.amount > 0);
//
//     for (const token of tokenData) {
//         const {name, symbol, decimals, logoURI, amount, usd, price_24h_change} = token;
//
//         const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;
//
//
//         const [dbToken] = await TokenModel.upsert({
//             chain_id: 'sol', name, symbol, decimals, logo_path: logoPath, price: usd, price_24h_change
//         }, {conflictFields: ['chain_id', 'symbol'], returning: true});
//
//
//         const raw_amount = amount * 10 ** decimals;
//         const usd_value = amount * usd;
//
//         await WalletTokenModel.upsert({
//             wallet_id: walletId, token_id: dbToken.id, amount, raw_amount, usd_value
//         });
//     }
//
//     console.log(`Token data successfully saved/updated for Solana wallet ID ${walletId}`);
// };
// export const fetchAndSaveSolTokenDataForAllWallets = async () => {
//     try {
//         const wallets = await WalletModel.findAll({
//             order: [['id', 'ASC']], where: {chain: 'sol'}
//         });
//         for (const wallet of wallets) {
//             await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
//         }
//
//     } catch (error) {
//         console.error('Error fetching Solana token data for all wallets:', error.message);
//     }
// };