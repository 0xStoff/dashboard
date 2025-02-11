import express from 'express';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import * as querystring from "querystring";
import crypto from 'crypto';
import TransactionModel from "../models/TransactionsModel.js";
import WalletModel from "../models/WalletModel.js";
import { Op } from "sequelize";

// Load environment variables
dotenv.config();

const router = express.Router();

/**
 * Helper function to create a Binance signature
 * @param {string} queryString - The query string for the API request.
 * @param {string} secret - The Binance API secret.
 * @returns {string} - The HMAC SHA256 signature.
 */
const createBinanceSignature = (queryString, secret) => {
    return CryptoJS.HmacSHA256(queryString, secret).toString();
};

/**
 * Fetch Binance data utility function
 * @param {string} endpoint - Binance API endpoint.
 * @param {string} apiKey - Binance API key.
 * @param {string} apiSecret - Binance API secret.
 * @param {object} params - Query parameters for the API request.
 * @returns {Promise<object>} - The API response data.
 */
const fetchBinanceData = async (endpoint, apiKey, apiSecret, params) => {
    try {
        const queryString = new URLSearchParams(params).toString();
        const signature = createBinanceSignature(queryString, apiSecret);

        const headers = {'X-MBX-APIKEY': apiKey};
        const response = await axios.get(`https://api.binance.com${endpoint}?${queryString}&signature=${signature}`, {
            headers,
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching Binance data from ${endpoint}:`, error.response?.data || error.message);
        throw error.response?.data || error.message;
    }
};

// Binance Fiat Payments Endpoint
router.get('/binance/fiat-payments', async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    const transactionType = req.query.transactionType || 0;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

    const params = {
        transactionType,
        beginTime: new Date('2020-01-01').getTime(),
        endTime: Date.now(),
        timestamp: Date.now(),
    };

    try {
        const data = await fetchBinanceData('/sapi/v1/fiat/payments', apiKey, apiSecret, params);
        const completedPayments = (data.data || []).filter(order => order.status === 'Completed');

        for (const order of completedPayments) {
            await TransactionModel.upsert({
                exchange: "Binance",
                orderNo: order.orderNo,
                type: order.method,
                amount: order.amount,
                fee: order.totalFee,
                asset: order.asset,
                status: order.status,
                date: new Date(order.createTime),
            });
        }

        res.json(completedPayments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Binance fiat payments', details: error });
    }
});
// Binance Fiat Orders Endpoint
router.get('/binance/fiat-orders', async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    const transactionType = req.query.transactionType || 0;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

    const params = {
        transactionType,
        beginTime: new Date('2020-01-01').getTime(),
        endTime: Date.now(),
        timestamp: Date.now(),
    };

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
                asset: order.asset,
                status: order.status,
                date: new Date(order.createTime),
            });
        }

        res.json(successfulOrders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Binance fiat orders', details: error });
    }
});
/**
 * Generate Kraken API signature.
 * @param {string} urlPath - The Kraken API endpoint path.
 * @param {string|object} data - The request payload.
 * @param {string} secret - The Kraken API secret.
 * @returns {string} - The API signature.
 */
function getKrakenSignature(urlPath, data, secret) {
    let encoded;

    if (typeof data === 'string') {
        const jsonData = JSON.parse(data);
        encoded = jsonData.nonce + data;
    } else if (typeof data === 'object') {
        const dataStr = querystring.stringify(data);
        encoded = data.nonce + dataStr;
    } else {
        throw new Error('Invalid data type');
    }

    const sha256Hash = crypto.createHash('sha256').update(encoded).digest();
    const message = urlPath + sha256Hash.toString('binary');
    const secretBuffer = Buffer.from(secret, 'base64');
    const hmac = crypto.createHmac('sha512', secretBuffer);
    hmac.update(message, 'binary');
    return hmac.digest('base64');
}

/**
 * Fetch all Kraken ledgers for a specific asset with pagination.
 * @param {string} apiKey - The Kraken API key.
 * @param {string} apiSecret - The Kraken API secret.
 * @param {string} asset - The asset to fetch (e.g., "CHF", "EUR").
 * @returns {Promise<object[]>} - An array of all ledger entries.
 */
async function fetchKrakenLedgers(apiKey, apiSecret, asset, type) {
    const now = Math.floor(Date.now() / 1000);
    const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60;
    const allLedgers = [];
    let offset = 0;

    while (true) {
        const nonce = Date.now().toString();
        const data = JSON.stringify({
            nonce, asset, type, start: fiveYearsAgo, end: now, ofs: offset,
        });

        const signature = getKrakenSignature('/0/private/Ledgers', data, apiSecret);

        const config = {
            method: 'post', url: 'https://api.kraken.com/0/private/Ledgers', headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'API-Key': apiKey,
                'API-Sign': signature,
            }, data,
        };

        const response = await axios.request(config);

        // Handle the response
        const result = response.data?.result?.ledger || {};
        const ledgerEntries = Object.values(result);

        if (ledgerEntries.length === 0) {
            break; // Exit loop if no more records are found
        }

        allLedgers.push(...ledgerEntries);

        // Update offset for the next batch
        offset += ledgerEntries.length;
    }

    return allLedgers;
}


// Route to fetch ledgers for CHF and EUR
router.get('/kraken/ledgers', async (req, res) => {
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;
    const asset = req.query.asset;
    const types = req.query.type ? req.query.type.split(',') : ['deposit', 'withdrawal', 'trade'];

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

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
            });
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Kraken ledgers', details: error });
    }
});


router.get('/kraken/portfolio', async (req, res) => {
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Missing API key or secret' });
    }

    try {
        // Generate nonce and signature
        const nonce = Date.now().toString();
        const data = { nonce };
        const signature = getKrakenSignature('/0/private/BalanceEx', data, apiSecret);

        // Make the request to the Kraken API
        const response = await axios.post(
            'https://api.kraken.com/0/private/BalanceEx',
            querystring.stringify(data),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'API-Key': apiKey,
                    'API-Sign': signature,
                },
            }
        );

        res.json(response.data.result);
    } catch (error) {
        console.error('Error fetching Kraken portfolio:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to fetch Kraken portfolio',
            details: error.response?.data || error.message,
        });
    }
});


router.get('/gnosispay/transactions', async (req, res) => {
    try {
        const response = await axios.get("https://app.gnosispay.com/api/v1/transactions", {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Cookie: process.env.COOKIE,
            },
        });

        const transactions = response.data;

        for (const tx of transactions) {
            await TransactionModel.upsert({
                exchange: "Gnosis Pay",
                orderNo: null,
                type: "transaction",
                amount: tx.transactionAmount,
                fee: null,
                asset: null,
                status: tx.status || "Unknown",
                date: new Date(tx.createdAt),
                merchant: tx.merchant?.name || "Unknown",
                transactionAmount: tx.transactionAmount,
                billingAmount: tx.billingAmount,
            }, {
                conflictFields: ["date", "merchant"]
            });
        }

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching Gnosis Pay transactions:", error.message);
        res.status(500).json({ error: "Failed to fetch Gnosis Pay transactions", details: error.message });
    }
});
router.get('/transactions', async (req, res) => {
    try {
        const exchange = req.query.exchange;

        const whereCondition = {};
        if (exchange) {
            whereCondition.exchange = { [Op.iLike]: exchange };
        }

        const transactions = await TransactionModel.findAll({ where: whereCondition });

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions from DB:", error);
        res.status(500).json({ error: "Failed to fetch transactions from DB", details: error.message });
    }
});
export default router;