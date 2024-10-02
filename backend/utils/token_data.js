import axios from "axios";
import {downloadLogo} from "./download_logo.js";
import {pool} from "../db.js";

const fetchAndSaveTokenData = async (walletId, walletAddress) => {
    const apiUrl = 'https://pro-openapi.debank.com/v1/user/all_token_list';
    const accessKey = process.env.RABBY_ACCESS_KEY;

    const config = {
        headers: {
            accept: 'application/json',
            AccessKey: accessKey,
        },
        params: {
            id: walletAddress,
            is_all: false,
        },
    };

    try {
        const { data: tokens } = await axios.get(apiUrl, config);

        for (const token of tokens) {
            const { id, name, symbol, decimals, logo_url, amount, raw_amount, price, price_24h_change } = token;


            const queryText = `
                INSERT INTO tokens (chain_id, name, symbol, decimals, logo_path, price, price_24h_change)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (chain_id, symbol) 
                DO UPDATE SET name = $2, decimals = $4, logo_path = $5, price = $6, price_24h_change = $7
                RETURNING id;
            `;

            const logoPath = logo_url ? await downloadLogo(logo_url, id) : null;
            const values = [token.chain, name, symbol, decimals, logoPath, price, price_24h_change];
            const { rows } = await pool.query(queryText, values);

            const tokenId = rows[0].id;

            const walletQuery = `
                INSERT INTO wallets_tokens (wallet_id, token_id, amount, raw_amount)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (wallet_id, token_id)
                DO UPDATE SET amount = $3, raw_amount = $4;
            `;
            await pool.query(walletQuery, [walletId, tokenId, amount, raw_amount]);
        }

        console.log(`Token data successfully saved/updated for wallet ID ${walletId}`);
    } catch (error) {
        console.error(`Error fetching or saving token data for wallet ID ${walletId}:`, error.message);
    }
};

export const fetchAndSaveTokenDataForAllWallets = async () => {
    try {
        // Fetch all wallets from the database
        const walletQuery = `
            SELECT id, wallet FROM wallets WHERE chain='evm'
        `;
        const { rows: wallets } = await pool.query(walletQuery);

        // Loop through each wallet and fetch token data
        for (const wallet of wallets) {
            const { id: walletId, wallet: walletAddress } = wallet;
            await fetchAndSaveTokenData(walletId, walletAddress);
        }

        console.log('Token data for all wallets successfully updated');
    } catch (error) {
        console.error('Error fetching token data for all wallets:', error.message);
    }
};