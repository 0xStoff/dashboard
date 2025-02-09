import React from "react";
import { CircularProgress, Container } from "@mui/material";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFechTransactions";

const binanceTransactionColumns = [{ label: "Exchange", key: "exchange" },
  { label: "Order No", key: "orderNo" },
  { label: "Type", key: "type" },
  { label: "Amount", key: "amount" },
  { label: "Fee", key: "fee" },
  { label: "Asset", key: "asset" },
  { label: "Status", key: "status" },
  { label: "Date", key: "date" }];

const gnosisColumns = [{ label: "Created At", key: "createdAt" },
  { label: "Transaction Amount", key: "transactionAmountFormatted" },
  { label: "Billing Amount", key: "billingAmountFormatted" },
  { label: "Merchant", key: "merchantFormatted" },
  { label: "Status", key: "status" }];

const Transactions = () => {
  const { transactions, loading, gnosisTransactions, approvedSum } = useFetchTransactions();

  if (loading) {
    return (<Container>
        <CircularProgress />
      </Container>);
  }

  const formattedGnosisTransactions = gnosisTransactions.map((transaction) => ({
    createdAt: new Date(transaction.createdAt).toLocaleString(),
    transactionAmountFormatted: `${transaction.transactionAmount / 100} ${transaction.transactionCurrency.symbol}`,
    billingAmountFormatted: `${transaction.billingAmount / 100} ${transaction.billingCurrency.symbol}`,
    merchantFormatted: `${transaction.merchant.name.trim()} (${transaction.merchant.city})`,
    status: transaction.status
  }));

  return (<Container sx={{ marginTop: 10 }}>
      <TransactionCards transactions={transactions} approvedSum={approvedSum} />
      <TransactionsTable
        title="Gnosis Pay Transactions"
        transactions={formattedGnosisTransactions}
        columns={gnosisColumns}
      />
      <TransactionsTable
        title="Binance & Kraken Transactions"
        transactions={transactions}
        columns={binanceTransactionColumns}
      />
    </Container>);
};

export default Transactions;