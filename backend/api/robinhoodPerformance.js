import express from "express";
import { getRobinhoodPerformance } from "../services/robinhood/performanceService.js";
import { getHistoricalAuditStatus, startHistoricalAudit } from "../services/robinhood/historicalAuditService.js";
import {
    applyRobinhoodClassifications,
    deleteRobinhoodClassification,
    listRobinhoodClassifications,
    saveRobinhoodClassification,
} from "../services/robinhood/classificationService.js";

const router = express.Router();

router.get("/robinhood/performance", async (req, res) => {
    try {
        const userId = req.user?.user?.id;
        const [data, classifications] = await Promise.all([getRobinhoodPerformance({
            userId,
            force: req.query.refresh === "true",
        }), listRobinhoodClassifications(userId)]);
        return res.json(applyRobinhoodClassifications(data, classifications));
    } catch (error) {
        console.error("Robinhood performance fetch failed:", error.message);
        return res.status(502).json({ error: "Robinhood performance data is temporarily unavailable" });
    }
});

router.put("/robinhood/classifications/:transactionHash", async (req, res) => {
    try {
        const assignment = await saveRobinhoodClassification({
            userId: req.user?.user?.id,
            transactionHash: req.params.transactionHash,
            classification: req.body?.classification,
            lifecycleKey: req.body?.lifecycleKey,
            label: req.body?.label,
            notes: req.body?.notes,
            metadata: req.body?.metadata,
        });
        return res.json(assignment);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete("/robinhood/classifications/:transactionHash", async (req, res) => {
    try {
        await deleteRobinhoodClassification({
            userId: req.user?.user?.id,
            transactionHash: req.params.transactionHash,
        });
        return res.status(204).end();
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

// The historical GMGN set is an opt-in immutable evidence bundle. Reading
// status never contacts a provider; the only public explorer work happens in
// the explicit POST below.
router.get("/robinhood/history-audit", async (req, res) => {
    try {
        return res.json(await getHistoricalAuditStatus(req.user?.user?.id));
    } catch (error) {
        console.error("Robinhood history audit status failed:", error.message);
        return res.status(502).json({ error: "Historical audit status is temporarily unavailable" });
    }
});

const startHistoryAudit = async (req, res) => {
    try {
        // The task is staged and runs sequentially in the background. Always
        // acknowledge immediately so it cannot hold a browser request open for
        // many paginated Blockscout calls.
        return res.status(202).json(await startHistoricalAudit(req.user?.user?.id));
    } catch (error) {
        console.error("Robinhood history audit start failed:", error.message);
        return res.status(502).json({ error: "Historical audit could not be started" });
    }
};

router.post("/robinhood/history-audit/start", startHistoryAudit);
router.post("/robinhood/history-audit/retry", startHistoryAudit);

export default router;
