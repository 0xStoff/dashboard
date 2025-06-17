import React, {useState} from "react";
import {
    Button,
    CircularProgress,
    Container,
    useMediaQuery,
    TextField
} from "@mui/material";
import {Box, Typography} from "@mui/material";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFechTransactions";
import {useTheme} from "@mui/material/styles";

const binanceTransactionColumns = [{label: "Exchange", key: "exchange"}, {
    label: "Order No", key: "orderNo"
}, {label: "Type", key: "type"}, {label: "Amount", key: "amount"}, {label: "Fee", key: "fee"}, {
    label: "Asset", key: "asset"
}, {label: "Status", key: "status"}, {label: "Date", key: "date"}];

const gnosisColumns = [{label: "Created At", key: "createdAt"}, {
    label: "Transaction Amount", key: "transactionAmountFormatted"
}, {label: "Billing Amount", key: "billingAmountFormatted"}, {
    label: "Merchant", key: "merchantFormatted"
}, {label: "Status", key: "status"}];


const filterByDateRange = (items, dateKey, startDate: Date, endDate: Date) => {
    return items.filter(item => {
        const itemDate = new Date(item[dateKey]);
        return itemDate >= startDate && itemDate <= endDate;
    });
};

export const summarizeByDateRange = (transactions, startDate: Date, endDate: Date) => {
    const filtered = filterByDateRange(transactions, "date", startDate, endDate);
    const deposits = filtered.filter(tx => ["deposit", "credit card", "bank transfer"].includes(tx.type?.toLowerCase()));
    const withdrawals = filtered.filter(tx => tx.type?.toLowerCase() === "withdrawal");
    const totalDeposits = deposits.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const totalWithdrawals = withdrawals.reduce((sum, tx) => sum + (parseFloat(tx.chf_value) || 0), 0);
    const totalFees = filtered.reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);
    return {
        totalDeposits, totalWithdrawals, deposits, withdrawals, totalFees
    };
};
const Transactions = () => {
    const {transactions, loading, gnosisTransactions, refetch} = useFetchTransactions();
    const [startDate, setStartDate] = useState(new Date('2020-01-01'));
    const [endDate, setEndDate] = useState(new Date());

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    if (loading) {
        return (<Container>
            <CircularProgress/>
        </Container>);
    }

    const summary = summarizeByDateRange(transactions, startDate, endDate);
    const approvedSum = filterByDateRange(gnosisTransactions, "date", startDate, endDate)
        .filter(transaction => transaction.status === "Approved")
        .reduce((total, transaction) => total + Number(transaction.transactionAmount), 0) / 100;


    const formattedGnosisTransactions = gnosisTransactions.map((transaction) => ({
        createdAt: new Date(transaction.date).toLocaleDateString("de-CH", {
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
        }),
        transactionAmountFormatted: `${transaction.transactionAmount / 100} CHF`,
        billingAmountFormatted: `${transaction.billingAmount / 100} EUR`,
        merchantFormatted: `${transaction.merchant}`,
        status: transaction.status
    }));


    return (<Container sx={{marginTop: 10}}>
        <Button onClick={() => refetch()}>Refetch</Button>
        <TransactionCards transactions={[...summary.deposits, ...summary.withdrawals]} approvedSum={approvedSum}
                          totalFees={summary.totalFees}/>
        <Box sx={{display: "flex", gap: 2, mb: 2}}>
            <TextField
                label="Start Date"
                type="date"
                InputLabelProps={{shrink: true}}
                value={startDate.toISOString().split("T")[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
            />
            <TextField
                label="End Date"
                type="date"
                InputLabelProps={{shrink: true}}
                value={endDate.toISOString().split("T")[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
            />
        </Box>


        {!isMobile && <TransactionsTable
            title="Gnosis Pay Transactions"
            transactions={filterByDateRange(formattedGnosisTransactions, "createdAt", startDate, endDate)}
            columns={gnosisColumns}
        />}
        {!isMobile && <TransactionsTable
            title="Binance & Kraken Transactions"
            transactions={filterByDateRange(transactions, "date", startDate, endDate)}
            columns={binanceTransactionColumns}
        />}
    </Container>);
};

export default Transactions;