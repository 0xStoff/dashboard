import express from "express";
import { getPortfolioSnapshot } from "../services/portfolioSnapshotService.js";

const router = express.Router();

router.get("/dashboard/snapshot", async (req, res) => {
    try {
        const userId = req.user?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const snapshot = await getPortfolioSnapshot({
            userId,
            chain: req.query.chain || "all",
            walletId: req.query.wallet_id || "all",
            searchQuery: req.query.query || "",
        });
        return res.json(snapshot);
    } catch (error) {
        console.error("Failed to build canonical dashboard snapshot:", error);
        return res.status(500).json({ error: "Failed to build dashboard snapshot" });
    }
});

export default router;
