import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import TransactionModel from "../models/TransactionsModel.js";
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


const krakenCredentials = (req, res) => {
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
                transactionAmount: entry.transactionAmount || 0
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

        const response = await axios.get("https://api.gnosispay.com/api/v1/cards/transactions", {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${process.env.BEARER_TOKEN}`
            },
        });

        const transactions = response.data.results;

        const fetchEurToChfRate = async () => {
            try {
                const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
                    params: {
                        ids: "monerium-eur-money-2",
                        vs_currencies: "chf",
                        x_cg_demo_api_key: process.env.COINGECKO_API_KEY,
                    },
                });

                return response.data["monerium-eur-money-2"]?.chf ?? null;
            } catch (error) {
                console.error("Error fetching USD to CHF rate:", error);
                return null;
            }
        };

        const rate = await fetchEurToChfRate()

        for (const tx of transactions) {
            const createdAt = new Date(tx.createdAt);
            const isValidDate = !isNaN(createdAt.getTime());

            await TransactionModel.upsert({
                exchange: "Gnosis Pay",
                orderNo: tx.createdAt,
                type: "transaction",
                amount: tx.transactionAmount,
                fee: null,
                asset: null,
                status: tx.status || "Unknown",
                date: isValidDate ? createdAt : new Date(),
                merchant: tx.merchant?.name || "Unknown",
                transactionAmount: tx.transactionCurrency?.code === '978' ? Math.round(tx.transactionAmount * rate) : tx.transactionAmount,
                billingAmount: tx.billingCurrency?.code === '978' ? tx.billingAmount : null,
            });
        }

        res.json(transactions);
    } catch (error) {
        const details = error.response?.data || error.message || error.toString();
        console.error("Error fetching Gnosis Pay transactions:", details);
        res.status(500).json({error: "Failed to fetch Gnosis Pay transactions", details});
    }
});


router.post('/rubic/transactions', async (req, res) => {
    try {
        const addresses = Array.isArray(req.body?.addresses)
            ? req.body.addresses
            : (typeof req.body?.addresses === 'string'
                ? req.body.addresses.split(',').map(s => s.trim()).filter(Boolean)
                : []);

        if (!addresses.length) {
            return res.status(400).json({ error: "No addresses provided. Send { addresses: [\"0x...\"] }" });
        }

        const base = process.env.RUBIC_BACKEND_URL || "https://api.rubic.exchange";
        const root = base.replace(/\/$/, "");

        const allByAddress = {};
        let sumChf = 0;
        let totalCount = 0;

        for (const addr of addresses) {
            const url = `${root}/api/v2/trades/crosschain?address=${encodeURIComponent(addr)}&page=1&pageSize=100&ordering=-created_at`;
            const { data } = await axios.get(url);
            const results = Array.isArray(data?.results) ? data.results : [];
            totalCount += results.length;

            for (const s of results) {
                const toSym = (s.toSymbol || s.to_symbol || s.output_symbol || s.outputSymbol || s?.to_token?.symbol || "").toString().toLowerCase();
                if (toSym === "xmr" || toSym === "monero") {
                    const chf =
                        parseFloat(s.to_value_chf) ||
                        parseFloat(s.output_value_chf) ||
                        parseFloat(s.chf_value) ||
                        (s.volume_in_usd ? Number(s.volume_in_usd) * (Number(process.env.USD_TO_CHF_RATE || 0) || 0) : 0) ||
                        0;
                    sumChf += chf;
                    if (!allByAddress[addr]) allByAddress[addr] = { swaps: 0, chf: 0 };
                    allByAddress[addr].swaps += 1;
                    allByAddress[addr].chf += chf;

                    await TransactionModel.upsert({
                        exchange: "Rubic",
                        orderNo: s.id || s.hash || s.txHash || `${s.created_at}-${addr}`,
                        type: "swap",
                        amount: Number(s.toAmount) || Number(s.output_amount) || 0,
                        fee: 0,
                        asset: (s.toSymbol || s.to_symbol || s?.to_token?.symbol || "XMR").toString(),
                        status: "Completed",
                        date: new Date(s.created_at || s.createdAt || s.timestamp || Date.now()),
                        transactionAmount: chf
                    }, {
                        conflictFields: ["orderNo"]
                    });
                }
            }
        }

        return res.json({
            addresses,
            sumChf,
            totalCount,
            byAddress: allByAddress
        });
    } catch (error) {
        console.error("Error fetching transactions from Rubic:", error?.response?.data || error.message || error);
        res.status(500).json({ error: "Failed to fetch transactions from Rubic", details: error?.response?.data || error.message || String(error) });
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
            where: whereCondition, order: [['date', 'DESC']],
        });

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions from DB:", error);
        res.status(500).json({error: "Failed to fetch transactions from DB", details: error});
    }
});
export default router;