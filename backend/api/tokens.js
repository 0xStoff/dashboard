import express from "express";
import { fetchWalletData, transformData } from "./utils.js";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        const { chain, usd_value } = req.query;
        const wallets = await fetchWalletData(chain, usd_value);
        const result = transformData(wallets);


        res.json(result);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;