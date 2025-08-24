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
import CashflowChart from "../crypto/CashflowChart";

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


const toDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);

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


    // Build daily cashflow series
    const dayMap = new Map<string, { deposits: number; withdrawals: number }>();
    for (const tx of filteredTransactionsByDate) {
        const t = new Date(tx.date);
        if (isNaN(t.getTime())) continue;
        const key = toDay(t);
        const type = (tx.type || "").toLowerCase();
        const amt = Number(tx.amount) || 0;

        // Consider fees as outflows if you want: uncomment next line to subtract fees from deposits/withdrawals
        // const fee = Number(tx.fee) || 0;

        if (["deposit", "credit card", "bank transfer"].includes(type)) {
            const prev = dayMap.get(key) || { deposits: 0, withdrawals: 0 };
            dayMap.set(key, { ...prev, deposits: prev.deposits + amt });
        } else if (type === "withdrawal") {
            const prev = dayMap.get(key) || { deposits: 0, withdrawals: 0 };
            dayMap.set(key, { ...prev, withdrawals: prev.withdrawals + Math.abs(amt) });
        }
    }

    // Fill missing days so the cumulative line is continuous
    const days: string[] = [];
    for (let d = toDay(startDate), dt = new Date(d); dt <= new Date(toDay(endDate)); dt.setUTCDate(dt.getUTCDate() + 1)) {
        days.push(toDay(dt));
    }

    let cum = 0;
    const cashflowData = days.map(day => {
        const entry = dayMap.get(day) || { deposits: 0, withdrawals: 0 };
        const net = entry.deposits - entry.withdrawals;
        cum += net;
        return {
            date: day,
            deposits: +entry.deposits.toFixed(2),
            withdrawals: +entry.withdrawals.toFixed(2),
            net,
            netCumulative: +cum.toFixed(2),
        };
    });

    // Optional: if you have a holdings series, shape it like this and pass it to CashflowChart
    // const holdingsSeries = [{ date: "2024-01-01", value: 12345 }, ...];

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

            <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Cash flows over time
                </Typography>
                <CashflowChart
                    data={cashflowData}
                    // holdingsSeries={holdingsSeries} // pass your holdings series when available
                    height={360}
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