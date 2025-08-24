import { useEffect, useRef, useState, useCallback } from "react";
import apiClient from "../utils/api-client";

interface Transaction {
    orderNo: string;
    exchange: string;
    type: string;
    amount: number;
    asset: string;
    fee: number;
    status: string;
    date: string;
    timestamp: string | number;
    chf_value: number;
}

interface ApiTransaction {
    orderNo: string | null;
    exchange: string;
    type: string | null;
    amount: string | number;
    asset: string | null;
    fee: string | number;
    status: string | null;
    date: string | null;
    transactionAmount: number;
}

const useFetchTransactions = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [gnosisTransactions, setGnosisTransactions] = useState<any[]>([]);
    const effectRan = useRef<boolean>(false);

    /**
     * Fetches and formats transactions for a specific exchange
     * @param exchange - The exchange name to fetch transactions for
     * @returns Formatted transaction array
     */
    const fetchFormattedTransaction = async (exchange: string): Promise<Transaction[]> => {
        try {
            const response = await apiClient.get(`/transactions?exchange=${exchange}`);
            const { data } = response;

            return (
                data?.filter((d: ApiTransaction) => d.orderNo !== null)
                    .map((tx: ApiTransaction) => ({
                        orderNo: tx.orderNo as string,
                        exchange: tx.exchange,
                        type: tx.type ? tx.type.toString() : "Unknown",
                        amount: parseFloat(tx.amount as string) || 0,
                        asset: tx.asset || "Unknown",
                        fee: parseFloat(tx.fee as string) || 0,
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

    /**
     * Fetches transactions from Binance and Kraken and combines them
     */
    const fetchTransactions = async (): Promise<void> => {
        try {
            setLoading(true);

            const [binanceLedgers, krakenLedgers] = await Promise.all([
                fetchFormattedTransaction("binance"),
                fetchFormattedTransaction("kraken")
            ]);

            // Sort transactions by date (newest first)
            setTransactions(
                [...binanceLedgers, ...krakenLedgers].sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )
            );
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Fetches Gnosis Pay transactions
     */
    const fetchGnosisPayTransactions = async (): Promise<void> => {
        try {
            const { data } = await apiClient.get(`/transactions?exchange=Gnosis Pay`);
            setGnosisTransactions(data);
        } catch (error) {
            console.error("Error fetching Gnosis Pay transactions:", error);
        }
    };

    /**
     * Generic function to fetch transactions from a specific endpoint
     * @param endpoint - API endpoint to fetch from
     * @returns Transaction data from the endpoint
     */
    const fetchTransactionsFromServer = async (endpoint: string): Promise<any> => {
        try {
            const response = await apiClient.get(`/${endpoint}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transactions from ${endpoint}:`, error instanceof Error ? error.message : String(error));
            return [];
        }
    };

    /**
     * Refetches all transaction data
     */
    const refetch = useCallback(async (): Promise<void> => {
        await Promise.all([
            fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR,XMR"),
            fetchTransactionsFromServer("binance/fiat-payments"),
            fetchTransactionsFromServer("binance/fiat-orders"),
            apiClient.get(`/gnosispay/transactions`)
        ]);
    }, []);

    // Fetch data on component mount (only once)
    useEffect(() => {
        if (effectRan.current) return;
        effectRan.current = true;

        fetchTransactions();
        fetchGnosisPayTransactions();
    }, []);

    return { 
        transactions, 
        loading, 
        gnosisTransactions, 
        refetch 
    };
};

export default useFetchTransactions;