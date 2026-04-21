import express from "express";
import { getAvailableChains, getEnrichedChains } from "../services/chainService.js";

const router = express.Router();

router.get("/evm-chains", async (_req, res) => {
  try {
    const evmChains = (await getAvailableChains()).filter((chain) => chain.type === "evm");
    res.json(evmChains);
  } catch (err) {
    console.error("Error fetching chains", err);
    res.status(500).json({ error: "Failed to fetch chains" });
  }
});

router.get("/non-evm-chains", async (_req, res) => {
  try {
    const nonEvmChains = (await getAvailableChains()).filter((chain) => chain.type === "non-evm");
    res.json(nonEvmChains);
  } catch (err) {
    console.error("Error fetching non-EVM chains", err);
    res.status(500).json({ error: "Failed to fetch non-EVM chains" });
  }
});

router.get("/chains", async (req, res) => {
  try {
    const enrichedChains = await getEnrichedChains({
      walletId: req.query.wallet_id || "all",
      searchQuery: req.query.query || "",
      userId: req.user?.user?.id,
    });

    res.json(enrichedChains);
  } catch (err) {
    console.error("Error fetching chains:", err);
    res.status(500).json({ error: "Failed to fetch chains" });
  }
});

export default router;
