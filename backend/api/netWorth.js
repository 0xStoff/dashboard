import express from "express";
import NetWorth from "../models/NetWorthModel.js"; // Adjust the path to your model

const router = express.Router();


router.get("/net-worth", async (req, res) => {
  const { page, limit, includeDetails, latest } = req.query;

  try {
    if (latest === 'true') {
      const latestEntry = await NetWorth.findOne({
        order: [["date", "DESC"]],
      });

      if (!latestEntry) {
        return res.status(404).json({ error: "No net worth data found" });
      }

      return res.json({
        date: latestEntry.date,
        totalNetWorth: parseFloat(latestEntry.totalNetWorth),
        tokenHistory: latestEntry.history?.tokens || [],
        protocolHistory: latestEntry.history?.protocolsTable || [],
      });
    }

    const pg = parseInt(page) || 1;
    const lim = parseInt(limit) || 100;
    const offset = (pg - 1) * lim;
    const include = includeDetails !== 'false';

    const netWorthData = await NetWorth.findAll({
      order: [["date", "ASC"]],
      limit: limit ? lim : undefined,
      offset: limit ? offset : undefined,
    });

    const formattedData = netWorthData.map(entry => ({
      date: entry.date,
      totalNetWorth: parseFloat(entry.totalNetWorth),
      ...(include && {
        tokenHistory: entry.history?.tokens || [],
        protocolHistory: entry.history?.protocolsTable || []
      }),
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("Error fetching net worth data:", err);
    res.status(500).json({ error: "Failed to fetch net worth data" });
  }
});


router.post("/net-worth", async (req, res) => {
  const { date, totalNetWorth, historyData } = req.body;

  if (!date || !totalNetWorth) {
    return res.status(400).json({ error: "Date and totalNetWorth are required" });
  }

  try {
    const lastEntry = await NetWorth.findOne({
      order: [["date", "DESC"]],
    });


    if (lastEntry && parseFloat(lastEntry.totalNetWorth) === parseFloat(totalNetWorth.toFixed(8))) {
      return res.status(200).json({
        message: "Net worth not changed",
      });
    }

    await NetWorth.create({ date, totalNetWorth, history: historyData });
    res.status(201).json({ message: "Net worth saved successfully" });
  } catch (error) {
    console.error("Error saving net worth:", error);
    res.status(500).json({ error: "Failed to save net worth" });
  }
});

export default router;
