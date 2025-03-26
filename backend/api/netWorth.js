import express from "express";
import NetWorth from "../models/NetWorthModel.js"; // Adjust the path to your model

const router = express.Router();


router.get("/net-worth", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const includeDetails = req.query.includeDetails !== 'false';
  const offset = (page - 1) * limit;

  try {
    const netWorthData = await NetWorth.findAll({
      order: [["date", "ASC"]],
      limit,
      offset,
    });

    const formattedData = netWorthData.map(entry => ({
      date: entry.date,
      totalNetWorth: parseFloat(entry.totalNetWorth),
      ...(includeDetails && {
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
