import React, {useEffect, useRef, useState} from "react";
import axios from "axios";
import {
    Container, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography,
} from "@mui/material";

const ExchangesTable = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const effectRan = useRef(false);

    const fetchTransactionsFromServer = async (endpoint) => {
        try {
            const response = await axios.get(`http://localhost:3000/api/${endpoint}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transactions from ${endpoint}:`, error.message);
            throw error;
        }
    };

    // Fetch Binance fiat payments
    const fetchBinanceFiatPayments = async () => {
        try {
            const binanceFiatPayments = await fetchTransactionsFromServer("binance/fiat-payments");
            return binanceFiatPayments?.map((tx) => ({
                orderNo: tx.orderNo,
                exchange: "Binance",
                type: "Fiat Payment",
                amount: parseFloat(tx.sourceAmount),
                asset: tx.fiatCurrency,
                fee: parseFloat(tx.totalFee) || 0,
                status: tx.status,
                date: new Date(tx.createTime).toLocaleDateString(),
                timestamp: tx.createTime,
            })) || [];
        } catch (error) {
            console.error("Error fetching Binance fiat payments:", error);
            return [];
        }
    };

    // Fetch Binance fiat orders
    const fetchBinanceFiatOrders = async () => {
        try {
            const binanceFiatOrders = await fetchTransactionsFromServer("binance/fiat-orders");
            return binanceFiatOrders?.map((tx) => ({
                orderNo: tx.orderNo,
                exchange: "Binance",
                type: "Fiat Order",
                amount: parseFloat(tx.amount),
                asset: tx.fiatCurrency,
                fee: 0,
                status: tx.status,
                date: new Date(tx.createTime).toLocaleDateString(),
                timestamp: tx.createTime,
            })) || [];
        } catch (error) {
            console.error("Error fetching Binance fiat orders:", error);
            return [];
        }
    };

    // Fetch Kraken ledgers
    const fetchKrakenLedgers = async () => {
        try {
            const krakenLedgers = await fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR");
            return krakenLedgers.map((tx) => ({
                orderNo: tx.refid || "N/A",
                exchange: "Kraken",
                type: tx.type || "N/A",
                amount: parseFloat(tx.amount),
                asset: tx.asset || "N/A",
                fee: parseFloat(tx.fee) || 0,
                status: tx.type || "N/A",
                date: new Date(tx.time * 1000).toLocaleDateString(),
                timestamp: tx.time * 1000,
            })) || [];
        } catch (error) {
            console.error("Error fetching Kraken ledgers:", error);
            return [];
        }
    };


    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                if (effectRan.current) return; // Prevent double execution
                effectRan.current = true;

                const allTransactions = [];

                const [fiatPayments, fiatOrders, krakenLedgers] = await Promise.all([fetchBinanceFiatPayments(), fetchBinanceFiatOrders(), fetchKrakenLedgers(),]);

                allTransactions.push(...fiatPayments, ...fiatOrders, ...krakenLedgers);

                const sortedTransactions = allTransactions.sort((a, b) => b.timestamp - a.timestamp);
                setTransactions(sortedTransactions);

            } catch (error) {
                console.error("Error fetching transactions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, []);


    // Pagination handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    if (loading) {
        return (<Container>
            <Typography variant="h4" gutterBottom>
                Loading Transactions...
            </Typography>
        </Container>);
    }

    // Paginated data
    const paginatedTransactions = transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);


    const transactionsData = [
        { type: "Withdrew funds", details: "To Postfinance (*****************5193)", amountEUR: "-468.79", amountUSD: "-533.20" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "500", amountUSD: "591.55" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "820", amountUSD: "971.92" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "550", amountUSD: "644.46" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "455", amountUSD: "536.27" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "900", amountUSD: "1,058.54" },
        { type: "Withdrew funds", details: "To Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "-990", amountUSD: "-1,054.86" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "990", amountUSD: "1,105.22" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "1,500", amountUSD: "1,709.93" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "990", amountUSD: "1,102.67" },
        { type: "Deposited funds", details: "From Postfinance (CH59 0900 0000 8731 1519 3)", amountEUR: "10", amountUSD: "11.00" },
    ];

// Calculate totals for withdrawals and deposits
    const totalWithdrawals = transactions
        .filter((tx) => tx.type.toLowerCase() === "withdrawal")
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const totalDeposits = transactions
        .filter((tx) => tx.type.toLowerCase() === "deposit" || tx.type.toLowerCase() === "fiat payment" || tx.type.toLowerCase() === "fiat order")
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const totalFees = transactions
        .reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);

    return (<Container>
        <Typography variant="h5" gutterBottom>
            Transactions
        </Typography>
        <Typography variant="h6" gutterBottom>
            Total Deposits: {(totalDeposits + 6715.00).toFixed(2)}
        </Typography>
        <Typography variant="h6" gutterBottom>
            Total Withdrawals: {(totalWithdrawals - 1460.00).toFixed(2)}
        </Typography>
        <Typography variant="h6" gutterBottom>
            Total Fees: {totalFees.toFixed(2)} CHF
        </Typography>

        <TableContainer>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Order No</TableCell>
                        <TableCell>Exchange</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Fee</TableCell>
                        <TableCell>Asset</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {paginatedTransactions.map((tx, index) => (<TableRow key={index}>
                        <TableCell>{tx.orderNo}</TableCell>
                        <TableCell>{tx.exchange}</TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>{tx.amount}</TableCell>
                        <TableCell>{tx.fee}</TableCell>
                        <TableCell>{tx.asset}</TableCell>
                        <TableCell>{tx.status}</TableCell>
                        <TableCell>{tx.date}</TableCell>
                    </TableRow>))}
                </TableBody>
            </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
            component="div"
            count={transactions.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
        />
    </Container>);
};

export default ExchangesTable;