import express from "express";
import { getHideSmallBalances, setHideSmallBalances } from "../services/settingsService.js";

const router = express.Router();

router.get("/hidesmallbalances", async (_req, res) => {
  try {
    const value = await getHideSmallBalances();
    res.json({ value });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch setting" });
  }
});

router.post("/hidesmallbalances", async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== "number" || value < 0) {
      return res.status(400).json({ error: "Invalid value" });
    }

    await setHideSmallBalances(value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;
