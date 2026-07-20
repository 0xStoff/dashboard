import express from "express";
import CapitalFlow from "../models/CapitalFlowModel.js";

const router = express.Router();
const FLOW_TYPES = new Set(["deposit", "withdrawal"]);

const userIdFrom = (req) => req.user?.user?.id;

const serialize = (flow) => ({
  id: flow.id,
  scopeChainId: flow.scope_chain_id,
  type: flow.type,
  asset: flow.asset,
  amount: Number(flow.amount),
  usdValue: Number(flow.usd_value),
  occurredAt: flow.occurred_at,
  source: flow.source,
  txHash: flow.tx_hash,
  note: flow.note,
});

const parseFlow = (body) => {
  const amount = Number(body.amount);
  const usdValue = Number(body.usdValue);
  const occurredAt = new Date(body.occurredAt);

  if (
    !body.scopeChainId ||
    !FLOW_TYPES.has(body.type) ||
    !body.asset?.trim() ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(usdValue) ||
    usdValue < 0 ||
    Number.isNaN(occurredAt.getTime())
  ) {
    return null;
  }

  return {
    scope_chain_id: body.scopeChainId.trim(),
    type: body.type,
    asset: body.asset.trim().toUpperCase(),
    amount,
    usd_value: usdValue,
    occurred_at: occurredAt,
    source: body.source?.trim() || null,
    tx_hash: body.txHash?.trim() || null,
    note: body.note?.trim() || null,
  };
};

router.get("/capital-flows", async (req, res) => {
  try {
    const where = { user_id: userIdFrom(req) };
    if (req.query.scope_chain_id) {
      where.scope_chain_id = req.query.scope_chain_id;
    }

    const flows = await CapitalFlow.findAll({
      where,
      order: [["occurred_at", "ASC"], ["id", "ASC"]],
    });
    res.json(flows.map(serialize));
  } catch (error) {
    console.error("Failed to fetch capital flows:", error);
    res.status(500).json({ error: "Failed to fetch capital flows" });
  }
});

router.post("/capital-flows", async (req, res) => {
  const values = parseFlow(req.body);
  if (!values) {
    return res.status(400).json({ error: "Invalid capital flow" });
  }

  try {
    const flow = await CapitalFlow.create({ ...values, user_id: userIdFrom(req) });
    res.status(201).json(serialize(flow));
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "This transaction is already tracked" });
    }
    console.error("Failed to create capital flow:", error);
    res.status(500).json({ error: "Failed to create capital flow" });
  }
});

router.delete("/capital-flows/:id", async (req, res) => {
  try {
    const deleted = await CapitalFlow.destroy({
      where: { id: req.params.id, user_id: userIdFrom(req) },
    });
    if (!deleted) return res.status(404).json({ error: "Capital flow not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete capital flow:", error);
    res.status(500).json({ error: "Failed to delete capital flow" });
  }
});

export default router;
