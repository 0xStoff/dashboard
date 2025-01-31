import express from "express";
import { fetchWalletData, transformData } from "./utils.js";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        const usd_value = req.query.usd_value || 0;
        const chain = req.query.chain || "all";
        const walletId = req.query.wallet_id || "all";

        const wallets = await fetchWalletData(chain, usd_value, walletId);
        const result = transformData(wallets);
    // .reduce((sum, item) => sum + item.total_usd_value, 0) || 0;

        res.json(result);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;