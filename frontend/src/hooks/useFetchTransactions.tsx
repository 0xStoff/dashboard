import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../utils/api-client";
import { TransactionRecord } from "../interfaces";

const COMPLETED_RUBIC_STATUSES = new Set([
    "completed",
    "success",
    "successful",
    "done",
    "executed",
    "finished",
]);

const normalizeString = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;

const mapTransactionRecord = (transaction: Record<string, unknown>): TransactionRecord => ({
    orderNo: typeof transaction.orderNo === "string" ? transaction.orderNo : null,
    exchange: normalizeString(transaction.exchange, "Unknown"),
    type: normalizeString(transaction.type, "Unknown"),
    amount: Number(transaction.amount) || 0,
    asset: typeof transaction.asset === "string" ? transaction.asset : null,
    fee: Number(transaction.fee) || 0,
    status: normalizeString(transaction.status, "Unknown"),
    date: normalizeString(transaction.date),
    timestamp:
        typeof transaction.date === "string" || typeof transaction.date === "number" ? transaction.date : 0,
    chf_value: Number(transaction.transactionAmount) || 0,
    merchant: typeof transaction.merchant === "string" ? transaction.merchant : null,
    billingAmount: transaction.billingAmount ?? null,
    reference: typeof transaction.orderNo === "string" ? transaction.orderNo : null,
});

const useFetchTransactions = () => {
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [rubicXmrSum, setRubicXmrSum] = useState(0);
    const [rubicLoading, setRubicLoading] = useState(false);
    const effectRan = useRef(false);

    const fetchAllTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get<Record<string, unknown>[]>("/transactions");
            const rows = Array.isArray(response.data) ? response.data.map(mapTransactionRecord) : [];
            const sortedRows = rows.sort(
                (left, right) => new Date(String(right.date)).getTime() - new Date(String(left.date)).getTime()
            );

            setTransactions(sortedRows);

            const rubicTotal = sortedRows.reduce((sum, row) => {
                const symbol = (row.asset || "").toString().toLowerCase();
                const status = row.status.toLowerCase();
                return (symbol === "xmr" || symbol === "monero") && COMPLETED_RUBIC_STATUSES.has(status)
                    ? sum + (Number(row.chf_value) || 0)
                    : sum;
            }, 0);

            setRubicXmrSum(rubicTotal);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            setTransactions([]);
            setRubicXmrSum(0);
        } finally {
            setLoading(false);
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

    const refetch = useCallback(
        async (addresses: string[] = []) => {
            try {
                setRubicLoading(true);
                await Promise.all([
                    fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR,XMR"),
                    fetchTransactionsFromServer("binance/fiat-payments"),
                    fetchTransactionsFromServer("binance/fiat-orders"),
                    apiClient.get("/gnosispay/transactions"),
                    apiClient.post("/rubic/transactions", { addresses }),
                ]);
            } finally {
                setRubicLoading(false);
            }

            await fetchAllTransactions();
        },
        [fetchAllTransactions, fetchTransactionsFromServer]
    );

    useEffect(() => {
        if (effectRan.current) {
            return;
        }

        effectRan.current = true;
        fetchAllTransactions();
    }, [fetchAllTransactions]);

    return {
        transactions,
        loading,
        rubicXmrSum,
        rubicLoading,
        refetch,
    };
};

export default useFetchTransactions;
