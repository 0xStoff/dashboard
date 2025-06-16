import React from "react";
import {Button, CircularProgress, Container, useMediaQuery} from "@mui/material";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFechTransactions";
import {useTheme} from "@mui/material/styles";

const binanceTransactionColumns = [{label: "Exchange", key: "exchange"}, {
    label: "Order No",
    key: "orderNo"
}, {label: "Type", key: "type"}, {label: "Amount", key: "amount"}, {label: "Fee", key: "fee"}, {
    label: "Asset",
    key: "asset"
}, {label: "Status", key: "status"}, {label: "Date", key: "date"}];

const gnosisColumns = [{label: "Created At", key: "createdAt"}, {
    label: "Transaction Amount",
    key: "transactionAmountFormatted"
}, {label: "Billing Amount", key: "billingAmountFormatted"}, {
    label: "Merchant",
    key: "merchantFormatted"
}, {label: "Status", key: "status"}];

const Transactions = () => {
    const {transactions, loading, gnosisTransactions, approvedSum, refetch} = useFetchTransactions();


    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    if (loading) {
        return (<Container>
            <CircularProgress/>
        </Container>);
    }


    const formattedGnosisTransactions = gnosisTransactions.map((transaction) => ({
        createdAt: new Date(transaction.date).toLocaleDateString("de-CH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }),
        transactionAmountFormatted: `${transaction.transactionAmount / 100} CHF`,
        billingAmountFormatted: `${transaction.billingAmount / 100} EUR`,
        merchantFormatted: `${transaction.merchant}`,
        status: transaction.status
    }));

    return (<Container sx={{marginTop: 10}}>
        <Button onClick={() => refetch()}>Refetch</Button>
        <TransactionCards transactions={transactions} approvedSum={approvedSum}/>

        {!isMobile && <TransactionsTable
            title="Gnosis Pay Transactions"
            transactions={formattedGnosisTransactions}
            columns={gnosisColumns}
        />}
        {!isMobile && <TransactionsTable
            title="Binance & Kraken Transactions"
            transactions={transactions}
            columns={binanceTransactionColumns}
        />}
    </Container>);
};

export default Transactions;