import { useEffect, useRef, useState } from "react";
import axios from "axios";

const useFetchTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gnosisTransactions, setGnosisTransactions] = useState([]);
  const [approvedSum, setApprovedSum] = useState(0);
  const effectRan = useRef(false);

  const fetchTransactionsFromServer = async (endpoint) => {
    try {
      const response = await axios.get(`http://stoeff.xyz:3000/api/${endpoint}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching transactions from ${endpoint}:`, error.message);
      return [];
    }
  };

  const fetchBinanceFiatPayments = async () => {
    try {
      const data = await fetchTransactionsFromServer("binance/fiat-payments");
      return data?.map((tx) => ({
        orderNo: tx.orderNo,
        exchange: "Binance",
        type: "Fiat Payment",
        amount: parseFloat(tx.sourceAmount),
        asset: tx.fiatCurrency,
        fee: parseFloat(tx.totalFee) || 0,
        status: tx.status,
        date: new Date(tx.createTime).toLocaleDateString(),
        timestamp: tx.createTime
      })) || [];
    } catch (error) {
      return [];
    }
  };

  const fetchBinanceFiatOrders = async () => {
    try {
      const data = await fetchTransactionsFromServer("binance/fiat-orders");
      return data?.map((tx) => ({
        orderNo: tx.orderNo,
        exchange: "Binance",
        type: "Fiat Order",
        amount: parseFloat(tx.amount),
        asset: tx.fiatCurrency,
        fee: 0,
        status: tx.status,
        date: new Date(tx.createTime).toLocaleDateString(),
        timestamp: tx.createTime
      })) || [];
    } catch (error) {
      return [];
    }
  };

  const fetchKrakenLedgers = async () => {
    try {
      const data = await fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR");
      return data?.map((tx) => ({
        orderNo: tx.refid || "N/A",
        exchange: "Kraken",
        type: tx.type || "N/A",
        amount: parseFloat(tx.amount),
        asset: tx.asset || "N/A",
        fee: parseFloat(tx.fee) || 0,
        status: tx.type || "N/A",
        date: new Date(tx.time * 1000).toLocaleDateString(),
        timestamp: tx.time * 1000
      })) || [];
    } catch (error) {
      return [];
    }
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      if (effectRan.current) return; // Prevent double execution
      effectRan.current = true;

      try {
        const [fiatPayments, fiatOrders, krakenLedgers] = await Promise.all([
          fetchBinanceFiatPayments(),
          fetchBinanceFiatOrders(),
          fetchKrakenLedgers()
        ]);

        const sortedTransactions = [...fiatPayments, ...fiatOrders, ...krakenLedgers].sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(sortedTransactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // Fetch Gnosis Transactions
    const fetchGnosisPayTransactions = async () => {
      try {
        const response = await axios.get("http://stoeff.xyz:3000/api/gnosispay/transactions");
        const transactions = response.data;

        setGnosisTransactions(transactions);
        const sum = transactions
          .filter((transaction) => transaction.status === "Approved")
          .reduce((total, transaction) => total + Number(transaction.transactionAmount), 0);
        setApprovedSum(sum / 100);
      } catch (error) {
        console.error("Error fetching Gnosis Pay transactions:", error);
      }
    };

    fetchGnosisPayTransactions();
  }, []);

  return { transactions, loading, gnosisTransactions, approvedSum };
};

export default useFetchTransactions;
