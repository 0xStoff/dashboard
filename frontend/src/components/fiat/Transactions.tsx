import React, { useMemo, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Container,
    TextField,
    useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFetchTransactions";
import { useWallets } from "../../context/WalletsContext";
import {
    FormattedGnosisTransaction,
    GnosisTransactionRecord,
    TableColumn,
    TransactionRecord,
} from "../../interfaces";

const binanceTransactionColumns: TableColumn<TransactionRecord>[] = [
    { label: "Date", key: "date" },
    { label: "Exchange", key: "exchange" },
    { label: "Type", key: "type" },
    { label: "Amount", key: "amount" },
    { label: "Fee", key: "fee" },
    { label: "Asset", key: "asset" },
    { label: "Status", key: "status" },
];

const gnosisColumns: TableColumn<FormattedGnosisTransaction>[] = [
    { label: "Created At", key: "createdAt" },
    { label: "Transaction Amount", key: "transactionAmountFormatted" },
    { label: "Billing Amount", key: "billingAmountFormatted" },
    { label: "Merchant", key: "merchantFormatted" },
    { label: "Status", key: "status" },
];

const filterByDateRange = <T extends Record<string, unknown>>(
    items: T[],
    dateKey: keyof T,
    startDate: Date,
    endDate: Date
) =>
    items.filter((item) => {
        const itemDate = new Date(String(item[dateKey]));
        return itemDate >= startDate && itemDate <= endDate;
    });

const formatGnosisAmount = (amount: number | string | null, currency: string) =>
    `${(Number(amount) || 0) / 100} ${currency}`;

const Transactions = () => {
    const { transactions, loading, gnosisTransactions, rubicXmrSum, rubicLoading, refetch } =
        useFetchTransactions();
    const [startDate, setStartDate] = useState(new Date("2020-01-01"));
    const [endDate, setEndDate] = useState(new Date());

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const { wallets } = useWallets();

    const evmAddresses = useMemo(
        () => wallets.filter((wallet) => wallet.chain === "evm").map((wallet) => wallet.wallet),
        [wallets]
    );

    const filteredTransactionsByDate = useMemo(
        () => filterByDateRange(transactions, "date", startDate, endDate),
        [endDate, startDate, transactions]
    );

    const filteredGnosisTransactionsByDate = useMemo(
        () => filterByDateRange(gnosisTransactions, "date", startDate, endDate),
        [endDate, gnosisTransactions, startDate]
    );

    const formattedGnosisTransactions = useMemo<FormattedGnosisTransaction[]>(
        () =>
            filteredGnosisTransactionsByDate.map((transaction: GnosisTransactionRecord) => ({
                createdAt: transaction.date,
                transactionAmountFormatted: formatGnosisAmount(transaction.transactionAmount, "CHF"),
                billingAmountFormatted: formatGnosisAmount(transaction.billingAmount, "EUR"),
                merchantFormatted: transaction.merchant || "Unknown",
                status: transaction.status,
            })),
        [filteredGnosisTransactionsByDate]
    );

    const approvedSum = useMemo(
        () =>
            filteredGnosisTransactionsByDate
                .filter((transaction) => transaction.status === "Approved")
                .reduce((total, transaction) => total + (Number(transaction.transactionAmount) || 0), 0) / 100,
        [filteredGnosisTransactionsByDate]
    );

    const deposits = useMemo(
        () =>
            filteredTransactionsByDate.filter((transaction) =>
                ["deposit", "credit card", "bank transfer"].includes(transaction.type.toLowerCase())
            ),
        [filteredTransactionsByDate]
    );

    const withdrawals = useMemo(
        () => filteredTransactionsByDate.filter((transaction) => transaction.type.toLowerCase() === "withdrawal"),
        [filteredTransactionsByDate]
    );

    const totalFees = useMemo(
        () => filteredTransactionsByDate.reduce((sum, transaction) => sum + (Number(transaction.fee) || 0), 0),
        [filteredTransactionsByDate]
    );

    if (loading) {
        return (
            <Container>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container sx={{ marginTop: 10 }}>
            <Button onClick={() => refetch(evmAddresses)}>Refetch</Button>

            <TransactionCards
                transactions={[...deposits, ...withdrawals]}
                approvedSum={approvedSum}
                totalFees={totalFees}
                rubicXmrSum={rubicXmrSum}
                rubicLoading={rubicLoading}
            />

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                    label="Start Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={startDate.toISOString().split("T")[0]}
                    onChange={(event) => setStartDate(new Date(event.target.value))}
                />
                <TextField
                    label="End Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={endDate.toISOString().split("T")[0]}
                    onChange={(event) => setEndDate(new Date(event.target.value))}
                />
            </Box>

            {!isMobile && (
                <TransactionsTable
                    title="Gnosis Pay Transactions"
                    transactions={formattedGnosisTransactions}
                    columns={gnosisColumns}
                />
            )}

            {!isMobile && (
                <TransactionsTable
                    title="Binance & Kraken Transactions"
                    transactions={filteredTransactionsByDate}
                    columns={binanceTransactionColumns}
                />
            )}
        </Container>
    );
};

export default Transactions;
