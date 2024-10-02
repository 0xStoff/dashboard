import axios from "axios";
import {downloadLogo} from "./download_logo.js";
import {pool} from "../db.js";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {Connection, PublicKey} from "@solana/web3.js";
import {Raydium} from "@raydium-io/raydium-sdk-v2";
import Wallet from "../models/Wallet.js";
import WalletToken from "../models/WalletToken.js";
import Token from "../models/Token.js";

const fetchAndSaveEvmTokenData = async (walletId, walletAddress) => {
    const apiUrl = 'https://pro-openapi.debank.com/v1/user/all_token_list';
    const accessKey = process.env.RABBY_ACCESS_KEY;

    const config = {
        headers: {
            accept: 'application/json', AccessKey: accessKey,
        }, params: {
            id: walletAddress, is_all: false,
        },
    };

    try {
        const {data: tokens} = await axios.get(apiUrl, config);

        for (const token of tokens) {
            const {id, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change} = token;


            const queryText = `
                INSERT INTO tokens (chain_id, name, symbol, decimals, logo_path, price, price_24h_change)
                VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (chain_id, symbol)
                DO
                UPDATE SET name = $2, decimals = $4, logo_path = $5, price = $6, price_24h_change = $7
                    RETURNING id;
            `;

            const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;
            const values = [token.chain, name, symbol, decimals, logoPath, price, price_24h_change];
            const {rows} = await pool.query(queryText, values);

            const tokenId = rows[0].id;

            const walletQuery = `
                INSERT INTO wallets_tokens (wallet_id, token_id, amount, raw_amount)
                VALUES ($1, $2, $3, $4) ON CONFLICT (wallet_id, token_id)
                DO
                UPDATE SET amount = $3, raw_amount = $4;
            `;
            await pool.query(walletQuery, [walletId, tokenId, amount, raw_amount]);
        }

        console.log(`Token data successfully saved/updated for wallet ID ${walletId}`);
    } catch (error) {
        console.error(`Error fetching or saving token data for wallet ID ${walletId}:`, error.message);
    }
};

export const fetchAndSaveEvmTokenDataForAllWallets = async () => {
    try {
        // Fetch all wallets from the database
        const walletQuery = `
            SELECT id, wallet
            FROM wallets
            WHERE chain = 'evm'
        `;
        const {rows: wallets} = await pool.query(walletQuery);

        // Loop through each wallet and fetch token data
        for (const wallet of wallets) {
            const {id: walletId, wallet: walletAddress} = wallet;
            await fetchAndSaveEvmTokenData(walletId, walletAddress);
        }

        console.log('Token data for all wallets successfully updated');
    } catch (error) {
        console.error('Error fetching token data for all wallets:', error.message);
    }
};

// Fetch and save Solana token data
export const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
    const connection = new Connection('https://solana-rpc.publicnode.com/');
    const owner = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });

    const raydium = await Raydium.load({
        connection,
        owner,
        disableLoadToken: false
    });

    const balance = await connection.getBalance(owner);
    const solPrice = await fetchTokenPrice('solana') || { usd: 0 };

    let tokenData = [{
        amount: balance / 10 ** 9,
        name: 'Solana',
        logoURI: 'https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png',
        symbol: 'SOL',
        decimals: 9,
        usd: solPrice.usd
    }];

    for (const accountInfo of tokenAccounts.value) {
        const parsedAccountInfo = accountInfo.account.data.parsed.info;
        const tokenAddress = parsedAccountInfo.mint;

        const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);

        if (tokenInfo) {
            const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
            if (tokenPrice) {
                tokenData.push({
                    ...tokenInfo,
                    amount: parsedAccountInfo.tokenAmount.uiAmount,
                    usd: tokenPrice.usd
                });
            }
        }
    }

    // console.log(tokenData)


    tokenData = tokenData.filter(token => token.amount > 0);

    for (const token of tokenData) {
        const {  name, symbol, decimals, logoURI, amount, usd } = token;

        const queryText = `
            INSERT INTO tokens (chain_id, name, symbol, decimals, logo_path, price)
            VALUES ('sol', $1, $2, $3, $4, $5)
            ON CONFLICT (chain_id, symbol)
            DO UPDATE SET name = $1, decimals = $3, logo_path = $4, price = $5
            RETURNING id;
        `;

        const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;
        const { rows } = await pool.query(queryText, [name, symbol, decimals, logoPath, usd]);

        const tokenId = rows[0].id;

        // Save wallet-token relationship in wallets_tokens table
        const walletQuery = `
            INSERT INTO wallets_tokens (wallet_id, token_id, amount, raw_amount)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (wallet_id, token_id)
            DO UPDATE SET amount = $3, raw_amount = $4;
        `;
        const rawAmount = amount * 10 ** decimals; // Convert to raw amount
        await pool.query(walletQuery, [walletId, tokenId, amount, rawAmount]);
    }

    console.log(`Token data successfully saved/updated for Solana wallet ID ${walletId}`);
};

// // Fetch token price using Coingecko API
export const fetchAndSaveSolTokenDataForAllWallets = async () => {
    try {
        const walletQuery = `
            SELECT id, wallet
            FROM wallets
            WHERE chain = 'sol'
        `;
        const { rows: wallets } = await pool.query(walletQuery);

        for (const wallet of wallets) {
            const { id: walletId, wallet: walletAddress } = wallet;
            await fetchAndSaveSolTokenData(walletId, walletAddress);
        }

        console.log('Token data for all Solana wallets successfully updated');
    } catch (error) {
        console.error('Error fetching Solana token data for all wallets:', error.message);
    }
};

export const fetchTokenPrice = async (coingeckoId) => {
    try {
        if (!coingeckoId) return null;
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`, {
            params: {
                ids: coingeckoId,
                vs_currencies: 'usd'
            }
        });
        return response.data[coingeckoId]?.usd ? { usd: response.data[coingeckoId].usd } : null;
    } catch (error) {
        console.error(`Error fetching price for ${coingeckoId}:`, error);
        return null;
    }
};


// try {
//     const [dbToken, created] = await Token.upsert({ /* token data */ });
// } catch (error) {
//     if (error.name === 'SequelizeValidationError') {
//         console.error('Validation errors:', error.errors.map(e => e.message));
//     } else {
//         console.error('Unexpected error:', error);
//     }
// }

// // Fetch and save EVM token data
// const fetchAndSaveEvmTokenData = async (walletId, walletAddress) => {
//     const apiUrl = 'https://pro-openapi.debank.com/v1/user/all_token_list';
//     const accessKey = process.env.RABBY_ACCESS_KEY;
//
//     const config = {
//         headers: { accept: 'application/json', AccessKey: accessKey },
//         params: { id: walletAddress, is_all: false },
//     };
//
//     try {
//         const { data: tokens } = await axios.get(apiUrl, config);
//
//         for (const token of tokens) {
//             const { chain, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;
//
//             // Download logo if exists
//             const logoPath = logo_url ? await downloadLogo(logo_url, symbol) : null;
//
//             // Upsert token data in the database using Sequelize
//             const [dbToken, created] = await Token.upsert({
//                 chain_id: chain,
//                 name,
//                 symbol,
//                 decimals,
//                 logo_path: logoPath,
//                 price,
//                 price_24h_change
//             }, {
//                 conflict: ['chain_id', 'symbol'], // Conflict on chain_id and symbol
//                 returning: true // Return the updated or created token
//             });
//
//             // Insert or update wallet-token relationship
//             await WalletToken.upsert({
//                 wallet_id: walletId,
//                 token_id: dbToken.id,
//                 amount,
//                 raw_amount
//             });
//         }
//
//         console.log(`Token data successfully saved/updated for wallet ID ${walletId}`);
//     } catch (error) {
//         console.error(`Error fetching or saving token data for wallet ID ${walletId}:`, error.message || error);
//     }
// };
//
// const fetchAndSaveSolTokenData = async (walletId, walletAddress) => {
//     const connection = new Connection('https://solana-rpc.publicnode.com/');
//     const owner = new PublicKey(walletAddress);
//
//     const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
//     const raydium = await Raydium.load({ connection, owner, disableLoadToken: false });
//
//     const balance = await connection.getBalance(owner);
//     const solPrice = await fetchTokenPrice('solana') || { usd: 0 };
//
//     let tokenData = [{
//         amount: balance / 10 ** 9,
//         name: 'Solana',
//         logoURI: 'https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png',
//         symbol: 'SOL',
//         decimals: 9,
//         usd: solPrice.usd
//     }];
//
//     for (const accountInfo of tokenAccounts.value) {
//         const parsedAccountInfo = accountInfo.account.data.parsed.info;
//         const tokenAddress = parsedAccountInfo.mint;
//         const tokenInfo = raydium.token.tokenList.find(token => token.address === tokenAddress);
//
//         if (tokenInfo) {
//             const tokenPrice = await fetchTokenPrice(tokenInfo.extensions.coingeckoId || '');
//             if (tokenPrice) {
//                 tokenData.push({
//                     ...tokenInfo,
//                     amount: parsedAccountInfo.tokenAmount.uiAmount,
//                     usd: tokenPrice.usd
//                 });
//             }
//         }
//     }
//
//     tokenData = tokenData.filter(token => token.amount > 0);
//
//     for (const token of tokenData) {
//         const { name, symbol, decimals, logoURI, amount, usd } = token;
//
//         const logoPath = logoURI ? await downloadLogo(logoURI, symbol) : null;
//
//         // Insert or update token data using Sequelize
//         const [dbToken] = await Token.upsert({
//             chain_id: 'sol',
//             name,
//             symbol,
//             decimals,
//             logo_path: logoPath,
//             price: usd,
//         }, { returning: true });
//
//         const rawAmount = amount * 10 ** decimals; // Convert to raw amount
//
//         // Insert or update the wallet-token relationship
//         await WalletToken.upsert({
//             wallet_id: walletId,
//             token_id: dbToken.id,
//             amount,
//             raw_amount: rawAmount,
//         });
//     }
//
//     console.log(`Token data successfully saved/updated for Solana wallet ID ${walletId}`);
// };
//
// export const fetchAndSaveTokenDataForAllWallets = async () => {
//     try {
//         const wallets = await Wallet.findAll({ where: { chain: 'evm' } });
//         for (const wallet of wallets) {
//             await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet);
//         }
//
//         const solanaWallets = await Wallet.findAll({ where: { chain: 'sol' } });
//         for (const wallet of solanaWallets) {
//             await fetchAndSaveSolTokenData(wallet.id, wallet.wallet);
//         }
//
//         console.log('Token data for all wallets successfully updated');
//     } catch (error) {
//         console.error('Error fetching token data for all wallets:', error.message);
//     }
// };