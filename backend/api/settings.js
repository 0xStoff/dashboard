import express from "express";
import SettingsModel from "../models/SettingsModel.js";

const router = express.Router();

router.get("/hidesmallbalances", async (req, res) => {
  try {
    const setting = await SettingsModel.findOne({ where: { key: "HIDESMALLBALANCES" } });
    res.json({ value: setting ? setting.value : 10 });
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
    await SettingsModel.upsert({ key: "HIDESMALLBALANCES", value });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;