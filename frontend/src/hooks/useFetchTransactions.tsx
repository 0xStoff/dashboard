import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../utils/api-client";
import { GnosisTransactionRecord, TransactionRecord } from "../interfaces";

const mapTransactionRecord = (transaction: Record<string, unknown>): TransactionRecord => ({
    orderNo: typeof transaction.orderNo === "string" ? transaction.orderNo : null,
    exchange: typeof transaction.exchange === "string" ? transaction.exchange : "Unknown",
    type: typeof transaction.type === "string" ? transaction.type : "Unknown",
    amount: Number(transaction.amount) || 0,
    asset: typeof transaction.asset === "string" ? transaction.asset : "Unknown",
    fee: Number(transaction.fee) || 0,
    status: typeof transaction.status === "string" ? transaction.status : "Unknown",
    date: typeof transaction.date === "string" ? transaction.date : "",
    timestamp:
        typeof transaction.date === "string" || typeof transaction.date === "number"
            ? transaction.date
            : 0,
    chf_value: Number(transaction.transactionAmount) || 0,
});

const useFetchTransactions = () => {
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [gnosisTransactions, setGnosisTransactions] = useState<GnosisTransactionRecord[]>([]);
    const [rubicXmrSum, setRubicXmrSum] = useState(0);
    const [rubicLoading, setRubicLoading] = useState(false);
    const effectRan = useRef(false);

    const fetchFormattedTransaction = useCallback(async (exchange: string) => {
        try {
            const response = await apiClient.get<Record<string, unknown>[]>(`/transactions?exchange=${exchange}`);
            return (response.data || [])
                .filter((transaction) => transaction.orderNo !== null)
                .map(mapTransactionRecord);
        } catch (error) {
            console.error(`Error fetching formatted transaction for ${exchange}:`, error);
            return [];
        }
    }, []);

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);

            const [binanceLedgers, krakenLedgers, rubicRows] = await Promise.all([
                fetchFormattedTransaction("binance"),
                fetchFormattedTransaction("kraken"),
                fetchFormattedTransaction("rubic"),
            ]);

            setTransactions(
                [...binanceLedgers, ...krakenLedgers, ...rubicRows].sort(
                    (left, right) => new Date(String(right.date)).getTime() - new Date(String(left.date)).getTime()
                )
            );
        } catch (error) {
            console.error("Error fetching transactions:", error);
        } finally {
            setLoading(false);
        }
    }, [fetchFormattedTransaction]);

    const fetchGnosisPayTransactions = useCallback(async () => {
        try {
            const { data } = await apiClient.get<GnosisTransactionRecord[]>("/transactions?exchange=Gnosis Pay");
            setGnosisTransactions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching Gnosis Pay transactions:", error);
        }
    }, []);

    const fetchTransactionsFromServer = useCallback(async (endpoint: string) => {
        try {
            const response = await apiClient.get(`/${endpoint}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transactions from ${endpoint}:`, error);
            return [];
        }
    }, []);

    const fetchRubicXmrSum = useCallback(async (addresses: string[] = []) => {
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
    }, []);

    const fetchRubicFromDb = useCallback(async () => {
        try {
            const response = await apiClient.get<GnosisTransactionRecord[]>("/transactions?exchange=Rubic");
            const rows = Array.isArray(response.data) ? response.data : [];
            const total = rows.reduce((sum, row) => {
                const symbol = (row.asset || "").toString().toLowerCase();
                const chf = Number(row.transactionAmount) || 0;
                return symbol === "xmr" || symbol === "monero" ? sum + chf : sum;
            }, 0);
            setRubicXmrSum(total);
        } catch (error) {
            console.error("Error loading Rubic rows from DB:", error);
            setRubicXmrSum(0);
        }
    }, []);

    const refetch = useCallback(
        async (addresses: string[] = []) => {
            await Promise.all([
                fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR,XMR"),
                fetchTransactionsFromServer("binance/fiat-payments"),
                fetchTransactionsFromServer("binance/fiat-orders"),
                apiClient.get("/gnosispay/transactions"),
                apiClient.post("/rubic/transactions", { addresses }),
            ]);

            await Promise.all([fetchRubicFromDb(), fetchTransactions(), fetchGnosisPayTransactions()]);
        },
        [fetchGnosisPayTransactions, fetchRubicFromDb, fetchTransactions, fetchTransactionsFromServer]
    );

    useEffect(() => {
        if (effectRan.current) {
            return;
        }

        effectRan.current = true;
        fetchTransactions();
        fetchGnosisPayTransactions();
        fetchRubicFromDb();
    }, [fetchGnosisPayTransactions, fetchRubicFromDb, fetchTransactions]);

    return {
        transactions,
        loading,
        gnosisTransactions,
        rubicXmrSum,
        rubicLoading,
        fetchRubicXmrSum,
        refetch,
    };
};

export default useFetchTransactions;
