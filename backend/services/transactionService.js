import axios from "axios";
import TransactionModel from "../models/TransactionsModel.js";
import { fetchBinanceData, fetchKrakenLedgers } from "../utils/utils.js";

const FIAT_START_TIMESTAMP = new Date("2020-01-01").getTime();
const COMPLETED_RUBIC_STATUSES = new Set([
    "completed",
    "success",
    "successful",
    "done",
    "executed",
    "finished",
]);

export const getBinanceRequestConfig = () => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("Missing Binance API key or secret");
    }

    return {
        apiKey,
        apiSecret,
        params: {
            transactionType: 0,
            beginTime: FIAT_START_TIMESTAMP,
            endTime: Date.now(),
            timestamp: Date.now(),
        },
    };
};

export const getKrakenRequestConfig = (query = {}) => {
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("Missing Kraken API key or secret");
    }

    return {
        apiKey,
        apiSecret,
        asset: query.asset,
        types: typeof query.type === "string" ? query.type.split(",") : ["deposit", "withdrawal", "trade"],
    };
};

export const upsertTransactions = async (records) => {
    for (const record of records) {
        await TransactionModel.upsert(record, {
            conflictFields: ["orderNo"],
        });
    }
};

export const syncBinanceFiatPayments = async () => {
    const { apiKey, apiSecret, params } = getBinanceRequestConfig();
    const response = await fetchBinanceData("/sapi/v1/fiat/payments", apiKey, apiSecret, params);
    const completedPayments = (response.data || []).filter((order) => order.status === "Completed");

    await upsertTransactions(
        completedPayments.map((order) => ({
            exchange: "Binance",
            orderNo: order.orderNo,
            type: order.paymentMethod,
            amount: order.sourceAmount,
            fee: order.totalFee,
            asset: order.cryptoCurrency,
            status: order.status,
            date: new Date(order.createTime),
        }))
    );

    return completedPayments;
};

export const syncBinanceFiatOrders = async () => {
    const { apiKey, apiSecret, params } = getBinanceRequestConfig();
    const response = await fetchBinanceData("/sapi/v1/fiat/orders", apiKey, apiSecret, params);
    const successfulOrders = (response.data || []).filter((order) => order.status === "Successful");

    await upsertTransactions(
        successfulOrders.map((order) => ({
            exchange: "Binance",
            orderNo: order.orderNo,
            type: order.method,
            amount: order.amount,
            fee: order.totalFee,
            asset: order.fiatCurrency,
            status: order.status,
            date: new Date(order.createTime),
        }))
    );

    return successfulOrders;
};

export const syncKrakenLedgers = async (query = {}) => {
    const { apiKey, apiSecret, asset, types } = getKrakenRequestConfig(query);
    const results = [];

    for (const type of types) {
        const ledgers = await fetchKrakenLedgers(apiKey, apiSecret, asset, type);
        results.push(...ledgers);
    }

    await upsertTransactions(
        results.map((entry) => ({
            exchange: "Kraken",
            orderNo:
                entry.refid ||
                `${entry.time}-${entry.type || "unknown"}-${entry.asset || "asset"}-${entry.amount || "0"}`,
            type: entry.type,
            amount: entry.amount,
            fee: entry.fee,
            asset: entry.asset,
            status: entry.status || "Completed",
            date: new Date(entry.time * 1000),
            transactionAmount: entry.transactionAmount || 0,
        }))
    );

    return results;
};

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
        console.error("Error fetching EUR to CHF rate:", error.response?.data || error.message);
        return null;
    }
};

export const syncGnosisPayTransactions = async () => {
    const response = await axios.get("https://api.gnosispay.com/api/v1/cards/transactions", {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
        },
    });

    const transactions = response.data.results || [];
    const rate = await fetchEurToChfRate();

    await upsertTransactions(
        transactions.map((transaction) => {
            const createdAt = new Date(transaction.createdAt);
            const isValidDate = !Number.isNaN(createdAt.getTime());
            const isTransactionEur = transaction.transactionCurrency?.code === "978";

            return {
                exchange: "Gnosis Pay",
                orderNo: transaction.createdAt,
                type: "transaction",
                amount: transaction.transactionAmount,
                fee: null,
                asset: null,
                status: transaction.status || "Unknown",
                date: isValidDate ? createdAt : new Date(),
                merchant: transaction.merchant?.name || "Unknown",
                transactionAmount: isTransactionEur && rate
                    ? Math.round(transaction.transactionAmount * rate)
                    : transaction.transactionAmount,
                billingAmount: transaction.billingCurrency?.code === "978" ? transaction.billingAmount : null,
            };
        })
    );

    return transactions;
};

export const normalizeAddresses = (addresses) => {
    if (Array.isArray(addresses)) {
        return addresses.map((address) => String(address).trim()).filter(Boolean);
    }

    if (typeof addresses === "string") {
        return addresses
            .split(",")
            .map((address) => address.trim())
            .filter(Boolean);
    }

    return [];
};

export const syncRubicTransactions = async (addresses) => {
    const normalizedAddresses = normalizeAddresses(addresses);

    if (!normalizedAddresses.length) {
        throw new Error('No addresses provided. Send { addresses: ["0x..."] }');
    }

    const baseUrl = (process.env.RUBIC_BACKEND_URL || "https://api.rubic.exchange").replace(/\/$/, "");
    const byAddress = {};
    const transactionRecords = [];
    let sumChf = 0;
    let totalCount = 0;

    for (const address of normalizedAddresses) {
        const url = `${baseUrl}/api/v2/trades/crosschain?address=${encodeURIComponent(address)}&page=1&pageSize=100&ordering=-created_at`;
        const response = await axios.get(url);
        const results = Array.isArray(response.data?.results) ? response.data.results : [];
        totalCount += results.length;

        for (const swap of results) {
            const rawStatus = (
                swap.status ||
                swap.trade_status ||
                swap.tradeStatus ||
                swap.cross_chain_status ||
                swap.crossChainStatus ||
                "unknown"
            )
                .toString()
                .toLowerCase();
            const symbol = (
                swap.toSymbol ||
                swap.to_symbol ||
                swap.output_symbol ||
                swap.outputSymbol ||
                swap?.to_token?.symbol ||
                ""
            )
                .toString()
                .toLowerCase();

            const chf =
                parseFloat(swap.to_value_chf) ||
                parseFloat(swap.output_value_chf) ||
                parseFloat(swap.chf_value) ||
                (swap.volume_in_usd
                    ? Number(swap.volume_in_usd) * (Number(process.env.USD_TO_CHF_RATE || 0) || 0)
                    : 0) ||
                0;

            transactionRecords.push({
                exchange: "Rubic",
                orderNo: swap.id || swap.hash || swap.txHash || `${swap.created_at}-${address}`,
                type: "swap",
                amount: Number(swap.toAmount) || Number(swap.output_amount) || 0,
                fee: 0,
                asset: (swap.toSymbol || swap.to_symbol || swap?.to_token?.symbol || "XMR").toString(),
                status: rawStatus,
                date: new Date(swap.created_at || swap.createdAt || swap.timestamp || Date.now()),
                transactionAmount: chf,
            });

            if ((symbol === "xmr" || symbol === "monero") && COMPLETED_RUBIC_STATUSES.has(rawStatus)) {
                sumChf += chf;
                if (!byAddress[address]) {
                    byAddress[address] = { swaps: 0, chf: 0 };
                }

                byAddress[address].swaps += 1;
                byAddress[address].chf += chf;
            }
        }
    }

    await upsertTransactions(transactionRecords);

    return {
        addresses: normalizedAddresses,
        sumChf,
        totalCount,
        byAddress,
    };
};
