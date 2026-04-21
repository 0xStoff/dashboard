import express from "express";
import { getProtocolsTable } from "../services/protocolService.js";

const router = express.Router();

router.get("/protocols-table", async (req, res) => {
  try {
    const protocols = await getProtocolsTable({
      chain: req.query.chain || "all",
      walletId: req.query.wallet_id || "all",
      searchQuery: req.query.query ? req.query.query.toLowerCase() : "",
      userId: req.user?.user?.id,
    });

    res.json(protocols);
  } catch (err) {
    console.error("Error fetching protocols:", err);
    res.status(500).json({ error: "Failed to fetch protocols" });
  }
});

export default router;
