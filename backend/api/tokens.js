import express from "express";
import { fetchWalletData, transformData } from "../utils/utils.js";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        const usd_value = req.query.usd_value || 0;
        const chain = req.query.chain || "all";
        const walletId = req.query.wallet_id || "all";
        const searchQuery = req.query.query ? req.query.query.toLowerCase() : "";

        const userId = req.user?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const wallets = await fetchWalletData(chain, usd_value, walletId, userId);
        const result = await transformData(wallets);

        const filteredTokens = searchQuery
            ? result.filter(token =>
                token.symbol.toLowerCase().includes(searchQuery)
            )
            : result;

        res.json(filteredTokens);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;