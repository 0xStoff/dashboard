import express from 'express';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import * as querystring from "querystring";
import crypto from 'crypto';
import TransactionModel from "../models/TransactionsModel.js";
import WalletModel from "../models/WalletModel.js";
import {Op} from "sequelize";
import {binanceCredentials, fetchBinanceData, fetchKrakenLedgers} from "../utils/utils.js";

dotenv.config();

const router = express.Router();


router.get('/binance/fiat-payments', async (req, res) => {

    const {apiKey, apiSecret, params} = binanceCredentials(req, res)

    try {
        const data = await fetchBinanceData('/sapi/v1/fiat/payments', apiKey, apiSecret, params);


        const completedPayments = (data.data || []).filter(order => order.status === 'Completed');

        for (const order of completedPayments) {

            await TransactionModel.upsert({
                exchange: "Binance",
                orderNo: order.orderNo,
                type: order.paymentMethod,
                amount: order.sourceAmount,
                fee: order.totalFee,
                asset: order.cryptoCurrency,
                status: order.status,
                date: new Date(order.createTime),
            }, {
                conflictFields: ["orderNo"]
            })
        }

        res.json(completedPayments);
    } catch (error) {
        console.error("Failed to fetch Binance fiat payments:", error);
        res.status(500).json({error: 'Failed to fetch Binance fiat payments', details: error});
    }
});

router.get('/binance/fiat-orders', async (req, res) => {
    const {apiKey, apiSecret, params} = binanceCredentials(req, res)


    try {
        const data = await fetchBinanceData('/sapi/v1/fiat/orders', apiKey, apiSecret, params);


        const successfulOrders = (data.data || []).filter(order => order.status === 'Successful');

        for (const order of successfulOrders) {


            await TransactionModel.upsert({
                exchange: "Binance",
                orderNo: order.orderNo,
                type: order.method,
                amount: order.amount,
                fee: order.totalFee,
                asset: order.fiatCurrency,
                status: order.status,
                date: new Date(order.createTime),
            }, {
                conflictFields: ["orderNo"]
            })
        }

        res.json(successfulOrders);
    } catch (error) {
        console.error("Failed to fetch Binance fiat orders:", error);
        res.status(500).json({error: 'Failed to fetch Binance fiat orders', details: error});
    }
});



const krakenCredentials = (req, res)=> {
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;
    const asset = req.query.asset;
    const types = req.query.type ? req.query.type.split(',') : ['deposit', 'withdrawal', 'trade'];

    if (!apiKey || !apiSecret) {
        return res.status(400).json({error: 'Missing API key or secret'});
    }

    return {apiKey, apiSecret, asset, types}
}


router.get('/kraken/ledgers', async (req, res) => {
    const {apiKey, apiSecret, asset, types} = krakenCredentials(req, res)

    try {
        const results = [];
        for (const type of types) {
            const ledgers = await fetchKrakenLedgers(apiKey, apiSecret, asset, type);
            results.push(...ledgers);
        }

        for (const entry of results) {
            await TransactionModel.upsert({
                exchange: "Kraken",
                orderNo: entry.refid || null,
                type: entry.type,
                amount: entry.amount,
                fee: entry.fee,
                asset: entry.asset,
                status: entry.status || "Completed",
                date: new Date(entry.time * 1000),
            }, {
                conflictFields: ["orderNo"]
            });
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({error: 'Failed to fetch Kraken ledgers', details: error});
    }
});


router.get('/gnosispay/transactions', async (req, res) => {
    try {
        const response = await axios.get("https://app.gnosispay.com/api/v1/transactions", {
            headers: {
                "Content-Type": "application/json", Accept: "application/json", Cookie: process.env.COOKIE,
            },
        });

        const transactions = response.data;


        for (const tx of transactions) {
            await TransactionModel.upsert({
                exchange: "Gnosis Pay",
                orderNo: tx.createdAt,
                type: "transaction",
                amount: tx.transactionAmount,
                fee: null,
                asset: null,
                status: tx.status || "Unknown",
                date: new Date(tx.createdAt),
                merchant: tx.merchant?.name || "Unknown",
                transactionAmount: tx.transactionAmount,
                billingAmount: tx.billingAmount,
            });
        }

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching Gnosis Pay transactions:", error.message);
        res.status(500).json({error: "Failed to fetch Gnosis Pay transactions", details: error.message});
    }
});
router.get('/transactions', async (req, res) => {
    try {
        const exchange = req.query.exchange;

        const whereCondition = {};
        if (exchange) {
            whereCondition.exchange = {[Op.iLike]: exchange};
        }

        const transactions = await TransactionModel.findAll({
            where: whereCondition,
            order: [['date', 'DESC']],
        });

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions from DB:", error);
        res.status(500).json({error: "Failed to fetch transactions from DB", details: error.message});
    }
});
export default router;