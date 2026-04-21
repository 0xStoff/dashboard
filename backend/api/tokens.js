import express from "express";
import { getTokensForUser } from "../services/tokenService.js";

const router = express.Router();

router.get("/tokens", async (req, res) => {
    try {
        const usdValue = Number(req.query.usd_value || 0);
        const chain = req.query.chain || "all";
        const walletId = req.query.wallet_id || "all";
        const searchQuery = req.query.query ? req.query.query.toLowerCase() : "";

        const userId = req.user?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const tokens = await getTokensForUser({
            chain,
            walletId,
            searchQuery,
            minimumUsdValue: usdValue,
            userId,
        });

        res.json(tokens);
    } catch (err) {
        console.error("Error fetching tokens:", err);
        res.status(500).json({ error: "Failed to fetch tokens" });
    }
});

export default router;
