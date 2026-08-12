import express from "express";
import { getPoolRadarPools, getPoolRadarStatus, triggerPoolRadarIndex } from "../services/poolRadarService.js";

const router = express.Router();

router.get("/pool-radar/status", (_req, res) => res.json(getPoolRadarStatus()));

router.get("/pool-radar", async (_req, res) => {
    try {
        res.json({ pools: await getPoolRadarPools(), status: getPoolRadarStatus() });
    } catch (error) {
        console.error("Failed to load Pool Radar:", error);
        res.status(500).json({ error: "Failed to load cached pool data" });
    }
});

router.post("/pool-radar/index", async (_req, res) => res.status(202).json(await triggerPoolRadarIndex()));

export default router;
