import axios from 'axios';
import {pool} from "../db.js";
import {downloadLogo} from "../utils/download_logo.js";
import express from "express";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        const queryText = `
            SELECT t.id,
                   t.chain_id,
                   t.name,
                   t.symbol,
                   t.decimals,
                   t.price,
                   t.logo_path,
                   wt.amount,
                   wt.raw_amount,
                   w.wallet
            FROM tokens t
                     JOIN wallets_tokens wt ON t.id = wt.token_id
                     JOIN wallets w ON w.id = wt.wallet_id
            ORDER BY t.name;
        `;

        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({error: 'Failed to fetch tokens'});
    }
});

router.get('/tokens/:walletId', async (req, res) => {
    const {walletId} = req.params;

    try {
        const queryText = `
            SELECT t.id,
                   t.chain_id,
                   t.name,
                   t.symbol,
                   t.decimals,
                   t.price,
                   t.logo_path,
                   wt.amount,
                   wt.raw_amount,
                   w.wallet
            FROM tokens t
                     JOIN wallets_tokens wt ON t.id = wt.token_id
                     JOIN wallets w ON w.id = wt.wallet_id
            WHERE w.id = $1
            ORDER BY t.name;
        `;

        const result = await pool.query(queryText, [walletId]);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching tokens for wallet ${walletId}:`, err);
        res.status(500).json({error: `Failed to fetch tokens for wallet ${walletId}`});
    }
});
export default router;