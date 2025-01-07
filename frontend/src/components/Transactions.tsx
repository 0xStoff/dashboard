import React, {useEffect, useState, useRef} from "react";
import axios from "axios";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Paper,
    Container,
    Typography,
    Divider,
    Card,
    CardContent,
    Tooltip,
} from "@mui/material";
import SummaryWithIcons from "../../archive/SummaryWithIcons";
import {Box} from "@mui/system";

const Transactions = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const effectRan = useRef(false);

    const [gnosisTransactions, setGnosisTransactions] = useState([]);
    const [approvedSum, setApprovedSum] = useState(0);

    const [binancePage, setBinancePage] = useState(0);
    const [binanceRowsPerPage, setBinanceRowsPerPage] = useState(10);

    const [gnosisPage, setGnosisPage] = useState(0);
    const [gnosisRowsPerPage, setGnosisRowsPerPage] = useState(10);

    const handleBinancePageChange = (event, newPage) => {
        setBinancePage(newPage);
    };

    const handleBinanceRowsPerPageChange = (event) => {
        setBinanceRowsPerPage(parseInt(event.target.value, 10));
        setBinancePage(0);
    };

    const handleGnosisPageChange = (event, newPage) => {
        setGnosisPage(newPage);
    };

    const handleGnosisRowsPerPageChange = (event) => {
        setGnosisRowsPerPage(parseInt(event.target.value, 10));
        setGnosisPage(0);
    };
    // Fetch Binance and Kraken Transactions
    const fetchTransactionsFromServer = async (endpoint) => {
        try {
            const response = await axios.get(`http://localhost:3000/api/${endpoint}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching transactions from ${endpoint}:`, error.message);
            throw error;
        }
    };

    const fetchBinanceFiatPayments = async () => {
        try {
            const binanceFiatPayments = await fetchTransactionsFromServer("binance/fiat-payments");
            return (binanceFiatPayments?.map((tx) => ({
                orderNo: tx.orderNo,
                exchange: "Binance",
                type: "Fiat Payment",
                amount: parseFloat(tx.sourceAmount),
                asset: tx.fiatCurrency,
                fee: parseFloat(tx.totalFee) || 0,
                status: tx.status,
                date: new Date(tx.createTime).toLocaleDateString(),
                timestamp: tx.createTime,
            })) || []);
        } catch (error) {
            console.error("Error fetching Binance fiat payments:", error);
            return [];
        }
    };

    const fetchBinanceFiatOrders = async () => {
        try {
            const binanceFiatOrders = await fetchTransactionsFromServer("binance/fiat-orders");
            return (binanceFiatOrders?.map((tx) => ({
                orderNo: tx.orderNo,
                exchange: "Binance",
                type: "Fiat Order",
                amount: parseFloat(tx.amount),
                asset: tx.fiatCurrency,
                fee: 0,
                status: tx.status,
                date: new Date(tx.createTime).toLocaleDateString(),
                timestamp: tx.createTime,
            })) || []);
        } catch (error) {
            console.error("Error fetching Binance fiat orders:", error);
            return [];
        }
    };

    const fetchKrakenLedgers = async () => {
        try {
            const krakenLedgers = await fetchTransactionsFromServer("kraken/ledgers?asset=CHF.HOLD,EUR.HOLD,CHF,EUR");
            return (krakenLedgers.map((tx) => ({
                orderNo: tx.refid || "N/A",
                exchange: "Kraken",
                type: tx.type || "N/A",
                amount: parseFloat(tx.amount),
                asset: tx.asset || "N/A",
                fee: parseFloat(tx.fee) || 0,
                status: tx.type || "N/A",
                date: new Date(tx.time * 1000).toLocaleDateString(),
                timestamp: tx.time * 1000,
            })) || []);
        } catch (error) {
            console.error("Error fetching Kraken ledgers:", error);
            return [];
        }
    };

    useEffect(() => {
        const fetchTransactions = async () => {
            if (effectRan.current) return; // Prevent double execution
            effectRan.current = true;

            try {
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

        // Fetch Gnosis Transactions
        const fetchGnosisPayTransactions = async () => {
            try {
                const response = await axios.get("http://localhost:3000/api/gnosispay/transactions");
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


    const totalWithdrawals = transactions
        .filter((tx) => tx.type.toLowerCase() === "withdrawal")
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    const totalDeposits = transactions
        .filter((tx) => ["deposit", "fiat payment", "fiat order"].includes(tx.type.toLowerCase()))
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

    const totalFees = transactions.reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);

    const paginatedBinanceTransactions = transactions.slice(binancePage * binanceRowsPerPage, binancePage * binanceRowsPerPage + binanceRowsPerPage);

    const paginatedGnosisTransactions = gnosisTransactions.slice(gnosisPage * gnosisRowsPerPage, gnosisPage * gnosisRowsPerPage + gnosisRowsPerPage);

    return (<Container>

        <Container sx={{display: 'flex', justifyContent: 'space-between', marginBottom: 5}}>
            <Card sx={{padding: 3, borderRadius: 10}}>
                <Typography variant="h5">Deposits</Typography>
                <Typography variant="h4" fontWeight="bold">
                    CHF {(+(totalDeposits + 6715.00).toFixed(2)).toLocaleString('de-CH')}
                </Typography>
            </Card>
            <Tooltip
                title={<Box>
                    <Typography variant="body2">gnosis {approvedSum.toFixed(2)} CHF</Typography>
                    <Typography variant="body2">
                        kraken {Math.abs(totalWithdrawals).toFixed(2)} CHF
                    </Typography>
                </Box>}
                arrow
            >
                <Card sx={{padding: 3, borderRadius: 10}}>
                    <Typography variant="h5">Withdrawals</Typography>
                    <Typography variant="h4" fontWeight="bold">
                        CHF {Math.abs(Number((totalWithdrawals - 1460.00 - approvedSum).toFixed(2))).toLocaleString('de-CH')}
                    </Typography>
                </Card>
            </Tooltip>
            <Card sx={{padding: 3, borderRadius: 10}}>
                <Typography variant="h5">Fees</Typography>
                <Typography variant="h4" fontWeight="bold">
                    CHF {totalFees.toFixed(2)}
                </Typography>
            </Card>
        </Container>


        <Typography
            variant="h5"
            gutterBottom
        >
            Binance & Kraken Transactions
        </Typography>
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Exchange</TableCell>
                        <TableCell>Order No</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Fee</TableCell>
                        <TableCell>Asset</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {paginatedBinanceTransactions.map((tx, index) => (<TableRow key={index}>
                        <TableCell>{tx.exchange}</TableCell>
                        <TableCell>{tx.orderNo}</TableCell>
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
        <TablePagination
            component="div"
            count={transactions.length}
            page={binancePage}
            onPageChange={handleBinancePageChange}
            rowsPerPage={binanceRowsPerPage}
            onRowsPerPageChange={handleBinanceRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50]}
        />

        <Typography
            variant="h5"
            gutterBottom
        >
            Gnosis Pay Transactions
        </Typography>
        <TableContainer component={Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Created At</TableCell>
                        <TableCell>Transaction Amount</TableCell>
                        <TableCell>Billing Amount</TableCell>
                        <TableCell>Merchant</TableCell>
                        <TableCell>Status</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {paginatedGnosisTransactions.map((transaction, index) => (<TableRow key={index}>
                        <TableCell>{new Date(transaction.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                            {transaction.transactionAmount / 100} {transaction.transactionCurrency.symbol}
                        </TableCell>
                        <TableCell>
                            {transaction.billingAmount / 100} {transaction.billingCurrency.symbol}
                        </TableCell>
                        <TableCell>
                            {transaction.merchant.name.trim()} ({transaction.merchant.city})
                        </TableCell>
                        <TableCell>{transaction.status}</TableCell>
                    </TableRow>))}
                </TableBody>
            </Table>
        </TableContainer>
        <TablePagination
            component="div"
            count={gnosisTransactions.length}
            page={gnosisPage}
            onPageChange={handleGnosisPageChange}
            rowsPerPage={gnosisRowsPerPage}
            onRowsPerPageChange={handleGnosisRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50]}
        />
    </Container>);
};

export default Transactions;