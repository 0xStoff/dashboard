import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import apiClient from "../utils/api-client";

const useFetchTransactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [gnosisTransactions, setGnosisTransactions] = useState([]);
    const [approvedSum, setApprovedSum] = useState(0);
    const effectRan = useRef(false);

    const fetchFormattedTransaction = async (exchange: string) => {
        try {
            const { data } = await apiClient.get(`/transactions?exchange=${exchange}`);

            return (
                data?.filter(d => d.orderNo !== null).map((tx) => ({
                    orderNo: tx.orderNo,
                    exchange: tx.exchange,
                    type: tx.type.toString(),
                    amount: parseFloat(tx.amount),
                    asset: tx.asset,
                    fee: parseFloat(tx.fee) || 0,
                    status: tx.status,
                    date: tx.date,
                    timestamp: tx.date
                })) || []
            );
        } catch (error) {
            return [];
        }
    };

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const [binanceLedgers, krakenLedgers] = await Promise.all([
                fetchFormattedTransaction("binance"),
                fetchFormattedTransaction("kraken")
            ]);

            const sortedTransactions = [...binanceLedgers, ...krakenLedgers].sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(sortedTransactions);
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

            const sum = data
                .filter(transaction => transaction.status === "Approved")
                .reduce((total, transaction) => total + Number(transaction.transactionAmount), 0);

            setApprovedSum(sum / 100);
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

    const refetch = useCallback(async () => {
        await Promise.all([
            fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR"),
            fetchTransactionsFromServer("binance/fiat-payments"),
            fetchTransactionsFromServer("binance/fiat-orders"),
            fetchTransactionsFromServer("binance/fiat-orders"),
            apiClient.get(`/gnosispay/transactions`)]);
    }, []);


    useEffect(() => {
        if (effectRan.current) return;
        effectRan.current = true;

        fetchTransactions();
        fetchGnosisPayTransactions();
    }, []);

    return { transactions, loading, gnosisTransactions, approvedSum, refetch };
};

export default useFetchTransactions;