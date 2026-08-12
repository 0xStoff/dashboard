import express from "express";
import {
  getDashboardSettings,
  getHideSmallBalances,
  setDashboardSettings,
  setHideSmallBalances,
} from "../services/settingsService.js";

const router = express.Router();
const THRESHOLD_MAX = 100;

const parseThreshold = (value) => Number(value);

router.get("/", async (_req, res) => {
  try {
    res.json(await getDashboardSettings());
  } catch (_error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req, res) => {
  const legacyThreshold = parseThreshold(req.body.hideSmallBalances);
  const candidate = {
    hideSmallAssetBalances: parseThreshold(req.body.hideSmallAssetBalances ?? legacyThreshold),
    hideSmallProtocolBalances: parseThreshold(req.body.hideSmallProtocolBalances ?? legacyThreshold),
    hideSmallNetworkBalances: parseThreshold(req.body.hideSmallNetworkBalances ?? legacyThreshold),
    defaultCurrencyChf: Number(req.body.defaultCurrencyChf),
    walletChipCount: Number(req.body.walletChipCount),
    compactRows: Number(req.body.compactRows),
  };
  const valid =
    Number.isFinite(candidate.hideSmallAssetBalances) && candidate.hideSmallAssetBalances >= 0 && candidate.hideSmallAssetBalances <= THRESHOLD_MAX &&
    Number.isFinite(candidate.hideSmallProtocolBalances) && candidate.hideSmallProtocolBalances >= 0 && candidate.hideSmallProtocolBalances <= THRESHOLD_MAX &&
    Number.isFinite(candidate.hideSmallNetworkBalances) && candidate.hideSmallNetworkBalances >= 0 && candidate.hideSmallNetworkBalances <= THRESHOLD_MAX &&
    [0, 1].includes(candidate.defaultCurrencyChf) &&
    Number.isInteger(candidate.walletChipCount) && candidate.walletChipCount >= 1 && candidate.walletChipCount <= 6 &&
    [0, 1].includes(candidate.compactRows);
  if (!valid) return res.status(400).json({ error: "Invalid settings" });

  try {
    res.json(await setDashboardSettings(candidate));
  } catch (_error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

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
    if (typeof value !== "number" || value < 0 || value > THRESHOLD_MAX) {
      return res.status(400).json({ error: "Invalid value" });
    }

    await setHideSmallBalances(value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;
