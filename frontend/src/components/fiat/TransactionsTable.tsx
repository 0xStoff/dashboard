import React, { useMemo, useState } from "react";
import {
    Box,
    Chip,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Switch,
    Tooltip,
    Typography,
} from "@mui/material";
import { TableColumn } from "../../interfaces";

interface ExcludableTransaction {
    orderNo: string | null;
    excludedFromTotals: boolean;
}

interface TransactionsTableProps<T extends ExcludableTransaction> {
    title: string;
    transactions: T[];
    columns: TableColumn<T>[];
    onToggleExcluded?: (orderNo: string, excluded: boolean) => Promise<void>;
}

const AMOUNT_COLUMNS = new Set(["amount", "transactionAmountFormatted", "billingAmountFormatted"]);
const COMPLETED_STATUSES = new Set(["Approved", "Completed"]);

const formatDateTime = (value: unknown) =>
    new Date(String(value)).toLocaleString("de-CH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });

function TransactionsTable<T extends ExcludableTransaction>({
    title,
    transactions,
    columns,
    onToggleExcluded,
}: TransactionsTableProps<T>) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const paginatedTransactions = useMemo(
        () => transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [page, rowsPerPage, transactions]
    );

    const handlePageChange = (_event: unknown, nextPage: number) => {
        setPage(nextPage);
    };

    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(Number.parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <>
            <Typography variant="h5" gutterBottom>
                {title}
            </Typography>
            <TableContainer component={Paper}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell key={String(column.key)}>{column.label}</TableCell>
                            ))}
                            {onToggleExcluded && <TableCell align="center">Totals</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedTransactions.map((transaction, rowIndex) => (
                            <TableRow
                                key={transaction.orderNo || rowIndex}
                                sx={{
                                    opacity: transaction.excludedFromTotals ? 0.5 : 1,
                                    transition: "opacity .2s, background-color .2s",
                                    backgroundColor: transaction.excludedFromTotals
                                        ? "rgba(255,255,255,.025)"
                                        : "transparent",
                                }}
                            >
                                {columns.map((column) => {
                                    const value = transaction[column.key];
                                    const status = String(
                                        (transaction as T & {status?: unknown}).status || ""
                                    );
                                    const isCompleted = COMPLETED_STATUSES.has(status);
                                    const key = String(column.key);

                                    if (key === "date" || key === "createdAt") {
                                        return <TableCell key={key}>{formatDateTime(value)}</TableCell>;
                                    }

                                    if (key === "status") {
                                        return (
                                            <TableCell key={key}>
                                                <Chip
                                                    label={String(value || "Unknown")}
                                                    size="small"
                                                    sx={{
                                                        color: isCompleted ? "success.main" : "error.main",
                                                    }}
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (key === "merchantFormatted") {
                                        return (
                                            <TableCell key={key}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            textDecoration: isCompleted ? "none" : "line-through",
                                                        }}
                                                    >
                                                        {String(value || "")}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        );
                                    }

                                    if (AMOUNT_COLUMNS.has(key)) {
                                        return (
                                            <TableCell key={key}>
                                                <Typography
                                                    sx={{
                                                        textDecoration: isCompleted ? "none" : "line-through",
                                                    }}
                                                >
                                                    {String(value ?? "")}
                                                </Typography>
                                            </TableCell>
                                        );
                                    }

                                    return <TableCell key={key}>{String(value ?? "")}</TableCell>;
                                })}
                                {onToggleExcluded && (
                                    <TableCell align="center">
                                        <Tooltip
                                            title={
                                                transaction.excludedFromTotals
                                                    ? "Excluded from totals"
                                                    : "Included in totals"
                                            }
                                        >
                                            <span>
                                                <Switch
                                                    size="small"
                                                    checked={!transaction.excludedFromTotals}
                                                    disabled={!transaction.orderNo}
                                                    onChange={(_event, checked) => {
                                                        if (transaction.orderNo) {
                                                            void onToggleExcluded(
                                                                transaction.orderNo,
                                                                !checked
                                                            );
                                                        }
                                                    }}
                                                    inputProps={{
                                                        "aria-label": transaction.excludedFromTotals
                                                            ? "Include transaction in totals"
                                                            : "Exclude transaction from totals",
                                                    }}
                                                />
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
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
        </>
    );
}

export default TransactionsTable;
