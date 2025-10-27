import { useEffect, useRef, useState, useCallback } from "react";
import apiClient from "../utils/api-client";

const useFetchTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gnosisTransactions, setGnosisTransactions] = useState([]);
    const [rubicXmrSum, setRubicXmrSum] = useState(0);
    const [rubicLoading, setRubicLoading] = useState(false);
    const effectRan = useRef(false);

    const fetchFormattedTransaction = async (exchange: string) => {
        try {
            const response = await apiClient.get(`/transactions?exchange=${exchange}`);
            const { data } = response;

            return (
                data?.filter(d => d.orderNo !== null).map((tx) => ({
                    orderNo: tx.orderNo,
                    exchange: tx.exchange,
                    type: tx.type ? tx.type.toString() : "Unknown",
                    amount: parseFloat(tx.amount) || 0,
                    asset: tx.asset || "Unknown",
                    fee: parseFloat(tx.fee) || 0,
                    status: tx.status || "Unknown",
                    date: tx.date || "N/A",
                    timestamp: tx.date || 0,
                    chf_value: tx.transactionAmount || 0
                })) || []
            );
        } catch (error) {
            console.error(`Error fetching formatted transaction for ${exchange}:`, error);
            return [];
        }
    };

    const fetchTransactions = async () => {
        try {
            setLoading(true);

            const [binanceLedgers, krakenLedgers, rubicRows] = await Promise.all([
                fetchFormattedTransaction("binance"),
                fetchFormattedTransaction("kraken"),
                fetchFormattedTransaction("rubic")
            ]);

            setTransactions([...binanceLedgers, ...krakenLedgers, ...rubicRows].sort((a, b) => new Date(b.date) - new Date(a.date)));
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchGnosisPayTransactions = async () => {
        try {
            const { data } = await apiClient.get(`/transactions?exchange=Gnosis Pay`);
            setGnosisTransactions(data);

        } catch (error) {
            console.error("Error fetching Gnosis Pay transactions:", error);
        }
    };


    const fetchTransactionsFromServer = async (endpoint) => {
        try {
            const response = await apiClient.get(`/${endpoint}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transactions from ${endpoint}:`, error.message);
            return [];
        }
    };

    const fetchRubicXmrSum = async (addresses = []) => {
        try {
            setRubicLoading(true);
            const { data } = await apiClient.post("/rubic/transactions", { addresses });
            setRubicXmrSum(Number(data?.sumChf) || 0);
        } catch (error) {
            console.error("Error fetching Rubic XMR sum:", error);
            setRubicXmrSum(0);
        } finally {
            setRubicLoading(false);
        }
    };

    const fetchRubicFromDb = async () => {
        try {
            const res = await apiClient.get(`/transactions?exchange=Rubic`);
            const rows = Array.isArray(res.data) ? res.data : [];
            const total = rows.reduce((acc, row) => {
                const sym = (row.asset || "").toString().toLowerCase();
                const chf = Number(row.transactionAmount) || 0;
                return (sym === "xmr" || sym === "monero") ? acc + chf : acc;
            }, 0);
            setRubicXmrSum(total);
        } catch (e) {
            console.error("Error loading Rubic rows from DB:", e);
            setRubicXmrSum(0);
        }
    };

    const refetch = useCallback(async (addresses = []) => {
        // 1) Pull fresh data from providers into the DB
        await Promise.all([
            fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR,XMR"),
            fetchTransactionsFromServer("binance/fiat-payments"),
            fetchTransactionsFromServer("binance/fiat-orders"),
            apiClient.get(`/gnosispay/transactions`),
            apiClient.post("/rubic/transactions", { addresses })
        ]);
        // 2) Refresh Rubic sum from DB
        await fetchRubicFromDb();
        // 3) Refresh combined transactions list from DB
        await fetchTransactions();
    }, []);


    useEffect(() => {
        if (effectRan.current) return;
        effectRan.current = true;

        fetchTransactions();
        fetchGnosisPayTransactions();
    }, []);

    return { transactions, loading, gnosisTransactions, rubicXmrSum, rubicLoading, refetch };
};

export default useFetchTransactions;