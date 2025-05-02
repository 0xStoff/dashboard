import React, {useState} from "react";
import {
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
    Box,
    Chip
} from "@mui/material";

const TransactionsTable = ({title, transactions, columns}) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handlePageChange = (event, newPage) => {
        setPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedTransactions = transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    console.log(columns)

    return (<>
            <Typography variant="h5" gutterBottom>
                {title}
            </Typography>
            <TableContainer component={Paper}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            {columns.map((column, index) => (<TableCell key={index}>{column.label}</TableCell>))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedTransactions.map((tx, index) => (<TableRow key={index}>
                                {columns.map((column, colIndex) => {
                                    const value = tx[column.key];

                                    if (column.key === "status") {
                                        return (<TableCell key={colIndex}>
                                                <Chip
                                                    label={value}
                                                    size="small"
                                                    sx={{
                                                        color:  ["Approved", "Completed"].includes(value) ? "success.main" : "error.main",
                                                    }}
                                                />
                                            </TableCell>);
                                    }

                                    if (column.key === "merchantFormatted") {
                                        return (<TableCell key={colIndex}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    {/*<Typography component="span" fontSize="1rem">🛒</Typography>*/}
                                                    <Typography variant="body2" sx={{
                                                      textDecoration: ["Approved", "Completed"].includes(tx.status) ? "none" : "line-through",                                                    }}>
                                                        {value}
                                                    </Typography>
                                                </Box>
                                            </TableCell>);
                                    }

                                    if (column.key === "amount" || "transactionAmountFormatted" || "billingAmountFormatted") {
                                        return (<TableCell key={colIndex}>
                                                <Typography
                                                    sx={{
                                                      textDecoration: ["Approved", "Completed"].includes(tx.status) ? "none" : "line-through",                                                    }}
                                                >
                                                    {value}
                                                </Typography>
                                            </TableCell>);
                                    }

                                    if (column.key === "date") {
                                        return (<TableCell key={colIndex}>
                                                <Typography variant="body2">
                                                    {new Intl.DateTimeFormat("en-US", {
                                                        weekday: "short",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric"
                                                    }).format(new Date(value))}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(value).toLocaleTimeString([], {
                                                        hour: "2-digit", minute: "2-digit"
                                                    })}
                                                </Typography>
                                            </TableCell>);
                                    }

                                    return <TableCell key={colIndex}>{value}</TableCell>;
                                })}
                            </TableRow>))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={transactions.length}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 25, 50]}
            />
        </>);
};

export default TransactionsTable;