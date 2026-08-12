import express from "express";
import sequelize from "../sequelize.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

const HISTORY_RANGES = Object.freeze({
  "7D": "7 days",
  "30D": "30 days",
  "90D": "90 days",
  "1Y": "1 year",
});

router.get("/net-worth/assets", async (req, res) => {
  const userId = req.user?.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });

  const type = String(req.query.type || "token").toLowerCase();
  const range = String(req.query.range || "ALL").toUpperCase();
  const symbol = String(req.query.symbol || "").trim();
  const name = String(req.query.name || "").trim();
  const chain = String(req.query.chain || "").trim();
  const contract = String(req.query.contract || "").trim();

  if (!['token', 'protocol'].includes(type)) {
    return res.status(400).json({ error: "Asset history type must be token or protocol" });
  }
  if (type === "token" && !contract && !symbol) {
    return res.status(400).json({ error: "Token contract or symbol is required" });
  }
  if (type === "protocol" && !name) {
    return res.status(400).json({ error: "Protocol name is required" });
  }

  const identityConditions = type === "protocol"
    ? ["LOWER(pa.name) = LOWER(:name)"]
    : [
        contract ? "LOWER(pa.contract_address) = LOWER(:contract)" : "LOWER(pa.symbol) = LOWER(:symbol)",
        chain ? "LOWER(pa.chain_id) = LOWER(:chain)" : null,
      ].filter(Boolean);
  const interval = HISTORY_RANGES[range];
  const rangeCondition = interval
    ? `AND ps.captured_at >= NOW() - INTERVAL '${interval}'`
    : "";

  try {
    const rows = await sequelize.query(
      `SELECT ps.captured_at AS date,
              CASE WHEN :type = 'token' THEN SUM(pas.balance) ELSE NULL END AS balance,
              SUM(pas.usd_value) AS "usdValue"
       FROM portfolio_asset_snapshots pas
       JOIN portfolio_snapshots ps ON ps.id = pas.snapshot_id
       JOIN portfolio_assets pa ON pa.id = pas.asset_id
       WHERE ps.user_id = :userId
         AND pa.user_id = :userId
         AND pa.asset_type = :type
         AND ${identityConditions.join(" AND ")}
         ${rangeCondition}
       GROUP BY ps.id, ps.captured_at
       ORDER BY ps.captured_at ASC`,
      {
        replacements: { userId, type, symbol, name, chain, contract },
        type: QueryTypes.SELECT,
      }
    );

    return res.json(rows.map((row) => ({
      date: row.date,
      balance: row.balance == null ? null : Number(row.balance),
      usdValue: Number(row.usdValue),
    })));
  } catch (err) {
    console.error("Error fetching asset history:", err);
    return res.status(500).json({ error: "Failed to fetch asset history" });
  }
});


router.get("/net-worth", async (req, res) => {
  const { page, limit, includeDetails, latest } = req.query;

  try {
    const userId = req.user?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
    if (latest === 'true') {
      const [latestEntry] = await sequelize.query(
        `SELECT captured_at AS date, total_usd AS "totalNetWorth"
         FROM portfolio_snapshots WHERE user_id = :userId
         ORDER BY captured_at DESC LIMIT 1`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      );

      if (!latestEntry) {
        return res.status(404).json({ error: "No net worth data found" });
      }

      return res.json({
        date: latestEntry.date,
        totalNetWorth: Number(latestEntry.totalNetWorth),
        tokenHistory: [],
        protocolHistory: [],
      });
    }

    const pg = parseInt(page) || 1;
    const lim = parseInt(limit) || 100;
    const offset = (pg - 1) * lim;
    const include = includeDetails !== 'false';

    const pagination = limit ? "LIMIT :lim OFFSET :offset" : "";
    const netWorthData = await sequelize.query(
      `SELECT captured_at AS date, total_usd AS "totalNetWorth"
       FROM portfolio_snapshots WHERE user_id = :userId
       ORDER BY captured_at ASC ${pagination}`,
      { replacements: { userId, lim, offset }, type: QueryTypes.SELECT }
    );
    const formattedData = netWorthData.map(entry => ({
      date: entry.date,
      totalNetWorth: Number(entry.totalNetWorth),
      ...(include && {
        tokenHistory: [],
        protocolHistory: []
      }),
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("Error fetching net worth data:", err);
    res.status(500).json({ error: "Failed to fetch net worth data" });
  }
});


router.post("/net-worth", async (req, res) => {
  res.status(405).json({ error: "Portfolio snapshots are captured by the backend refresh service." });
});

export default router;
