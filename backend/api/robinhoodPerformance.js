import express from "express";
import { getRobinhoodPerformance } from "../services/robinhood/performanceService.js";

const router = express.Router();

router.get("/robinhood/performance", async (req, res) => {
    try {
        const data = await getRobinhoodPerformance({
            userId: req.user?.user?.id,
            force: req.query.refresh === "true",
        });
        return res.json(data);
    } catch (error) {
        console.error("Robinhood performance fetch failed:", error.message);
        return res.status(502).json({ error: "Robinhood performance data is temporarily unavailable" });
    }
});

export default router;
