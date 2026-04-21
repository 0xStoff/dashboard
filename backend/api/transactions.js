import express from "express";
import { Op } from "sequelize";
import TransactionModel from "../models/TransactionsModel.js";
import {
    syncBinanceFiatOrders,
    syncBinanceFiatPayments,
    syncGnosisPayTransactions,
    syncKrakenLedgers,
    syncRubicTransactions,
} from "../services/transactionService.js";

const router = express.Router();

router.get("/binance/fiat-payments", async (_req, res) => {
    try {
        const completedPayments = await syncBinanceFiatPayments();
        return res.json(completedPayments);
    } catch (error) {
        console.error("Failed to fetch Binance fiat payments:", error);
        return res.status(500).json({
            error: "Failed to fetch Binance fiat payments",
            details: error.message || error,
        });
    }
});

router.get("/binance/fiat-orders", async (_req, res) => {
    try {
        const successfulOrders = await syncBinanceFiatOrders();
        return res.json(successfulOrders);
    } catch (error) {
        console.error("Failed to fetch Binance fiat orders:", error);
        return res.status(500).json({
            error: "Failed to fetch Binance fiat orders",
            details: error.message || error,
        });
    }
});

router.get("/kraken/ledgers", async (req, res) => {
    try {
        const results = await syncKrakenLedgers(req.query);
        return res.json(results);
    } catch (error) {
        console.error("Failed to fetch Kraken ledgers:", error);
        return res.status(500).json({
            error: "Failed to fetch Kraken ledgers",
            details: error.message || error,
        });
    }
});

router.get("/gnosispay/transactions", async (_req, res) => {
    try {
        const transactions = await syncGnosisPayTransactions();
        return res.json(transactions);
    } catch (error) {
        const details = error.response?.data || error.message || String(error);
        console.error("Error fetching Gnosis Pay transactions:", details);
        return res.status(500).json({
            error: "Failed to fetch Gnosis Pay transactions",
            details,
        });
    }
});

router.post("/rubic/transactions", async (req, res) => {
    try {
        const summary = await syncRubicTransactions(req.body?.addresses);
        return res.json(summary);
    } catch (error) {
        const details = error.response?.data || error.message || String(error);
        const statusCode = details.includes("No addresses provided") ? 400 : 500;
        console.error("Error fetching transactions from Rubic:", details);
        return res.status(statusCode).json({
            error: "Failed to fetch transactions from Rubic",
            details,
        });
    }
});

router.get("/transactions", async (req, res) => {
    try {
        const exchange = req.query.exchange;
        const where = {};

        if (exchange) {
            where.exchange = { [Op.iLike]: exchange };
        }

        const transactions = await TransactionModel.findAll({
            where,
            order: [["date", "DESC"]],
        });

        return res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions from DB:", error);
        return res.status(500).json({
            error: "Failed to fetch transactions from DB",
            details: error.message || error,
        });
    }
});

export default router;
