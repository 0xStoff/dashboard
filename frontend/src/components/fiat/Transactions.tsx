import React, { useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Container,
    TextField,
    Typography,
    useMediaQuery
} from "@mui/material";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFechTransactions";
import { useTheme } from "@mui/material/styles";

const binanceTransactionColumns = [
    { label: "Date", key: "date" },
    { label: "Exchange", key: "exchange" },
    // { label: "Order No", key: "orderNo" },
    { label: "Type", key: "type" },
    { label: "Amount", key: "amount" },
    { label: "Fee", key: "fee" },
    { label: "Asset", key: "asset" },
    { label: "Status", key: "status" },
];

const gnosisColumns = [
    { label: "Created At", key: "createdAt" },
    { label: "Transaction Amount", key: "transactionAmountFormatted" },
    { label: "Billing Amount", key: "billingAmountFormatted" },
    { label: "Merchant", key: "merchantFormatted" },
    { label: "Status", key: "status" }
];


const filterByDateRange = (items, dateKey, startDate: Date, endDate: Date) => {
    return items.filter(item => {
        const itemDate = new Date(item[dateKey]);
        return itemDate >= startDate && itemDate <= endDate;
    });
};


const Transactions = () => {
    const { transactions, loading, gnosisTransactions, refetch } = useFetchTransactions();
    const [startDate, setStartDate] = useState(new Date('2020-01-01'));
    const [endDate, setEndDate] = useState(new Date());

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    if (loading) {
        return (
            <Container>
                <CircularProgress />
            </Container>
        );
    }

    const filteredTransactionsByDate = filterByDateRange(transactions, "date", startDate, endDate);
    const filteredGnosisTransactionsByDate = filterByDateRange(gnosisTransactions, "date", startDate, endDate)

    const formattedGnosisTransactions = filteredGnosisTransactionsByDate.map(({ date, transactionAmount, billingAmount, merchant, status }) => ({
        createdAt: new Date(date).toLocaleString("de-CH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }),
        transactionAmountFormatted: `${transactionAmount / 100} CHF`,
        billingAmountFormatted: `${billingAmount / 100} EUR`,
        merchantFormatted: merchant,
        status
    }));

    const approvedSum = filteredGnosisTransactionsByDate
        .filter(transaction => transaction.status === "Approved")
        .reduce((total, transaction) => total + Number(transaction.transactionAmount), 0) / 100;


    const deposits = filteredTransactionsByDate.filter(tx => ["deposit", "credit card", "bank transfer"].includes(tx.type?.toLowerCase()));
    const withdrawals = filteredTransactionsByDate.filter(tx => tx.type?.toLowerCase() === "withdrawal");
    const totalFees = filteredTransactionsByDate.reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);

    return (
        <Container sx={{ marginTop: 10 }}>
            <Button onClick={refetch}>Refetch</Button>

            <TransactionCards
                transactions={[...deposits, ...withdrawals]}
                approvedSum={approvedSum}
                totalFees={totalFees}
            />

            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <TextField
                    label="Start Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={startDate.toISOString().split("T")[0]}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                />
                <TextField
                    label="End Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={endDate.toISOString().split("T")[0]}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
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