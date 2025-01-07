import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import axios from 'axios';

const GnosisTransactionsTable = () => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [gnosisTransactions, setGnosisTransactions] = useState([]);
    const [approvedSum, setApprovedSum] = useState(0); // State for the sum of approved transactions

    // Fetch transactions
    const fetchGnosisPayTransactions = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/gnosispay/transactions');
            const transactions = response.data;

            setGnosisTransactions(transactions);

            // Calculate the sum of approved transactions
            const sum = transactions
                .filter((transaction) => transaction.status === 'Approved')
                .reduce((total, transaction) => total + Number(transaction.transactionAmount), 0);
            setApprovedSum(sum);
        } catch (error) {
            console.error('Error fetching Gnosis Pay transactions:', error.message);
        }
    };

    useEffect(() => {
        fetchGnosisPayTransactions();
    }, []);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

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

    return (
        <Container>
            <Typography variant="h5" gutterBottom>
                Gnosis Pay Transactions
            </Typography>
            <Typography variant="h6" gutterBottom>
                Total Approved Amount: {approvedSum / 100} EUR
            </Typography>
            <TableContainer>
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
                        {gnosisTransactions
                            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            .map((transaction, index) => (
                                <TableRow key={index}>
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
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={gnosisTransactions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Container>
    );
};

export default GnosisTransactionsTable;