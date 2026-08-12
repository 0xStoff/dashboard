import React, { useMemo, useState } from "react";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
} from "@mui/material";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFetchTransactions";
import { useWallets } from "../../context/WalletsContext";
import {
    FormattedGnosisTransaction,
    GnosisTransactionRecord,
    TableColumn,
    TransactionRecord,
} from "../../interfaces";
import {
    calculateTransactionTotals,
    gnosisAmountChf,
    isApprovedGnosisTransaction,
    isIncluded,
    isSuccessful,
} from "../../utils/transaction-calculations";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";

const binanceTransactionColumns: TableColumn<TransactionRecord>[] = [
    { label: "Date", key: "date" },
    { label: "Exchange", key: "exchange" },
    { label: "Type", key: "type" },
    { label: "Amount", key: "amount" },
    { label: "CHF Value", key: "transactionAmount" },
    { label: "Fee", key: "fee" },
    { label: "Asset", key: "asset" },
    { label: "Reference", key: "merchant" },
    { label: "Status", key: "status" },
];

const gnosisColumns: TableColumn<FormattedGnosisTransaction>[] = [
    { label: "Created At", key: "createdAt" },
    { label: "Transaction Amount", key: "transactionAmountFormatted" },
    { label: "Billing Amount", key: "billingAmountFormatted" },
    { label: "Merchant", key: "merchantFormatted" },
    { label: "Status", key: "status" },
];

const filterByDateRange = <T extends object>(
    items: T[],
    dateKey: keyof T,
    startDate: string,
    endDate: string
) => {
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59.999`);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
        return [];
    }

    return items.filter((item) => {
        const itemDate = new Date(String(item[dateKey]));
        return !Number.isNaN(itemDate.getTime()) && itemDate >= rangeStart && itemDate <= rangeEnd;
    });
};

const formatGnosisAmount = (amount: number | string | null, currency: string) =>
    `${(Number(amount) || 0) / 100} ${currency}`;

const Transactions = () => {
    const {
        transactions,
        loading,
        gnosisTransactions,
        refetch,
        updateTransactionExclusion,
    } = useFetchTransactions();
    const today = new Date().toLocaleDateString("en-CA");
    const [startDate, setStartDate] = useState("2020-01-01");
    const [endDate, setEndDate] = useState(today);
    const [refetchDialogOpen, setRefetchDialogOpen] = useState(false);
    const [gnosisPayToken, setGnosisPayToken] = useState("");
    const [refetching, setRefetching] = useState(false);
    const [refetchError, setRefetchError] = useState("");
    const [transactionError, setTransactionError] = useState("");

    const { wallets } = useWallets();
    const { eurRate: eurToChfRate } = useUsdToChfRate();

    const closeRefetchDialog = () => {
        if (refetching) return;
        setGnosisPayToken("");
        setRefetchError("");
        setRefetchDialogOpen(false);
    };

    const handleRefetch = async () => {
        const token = gnosisPayToken.trim().replace(/^Bearer\s+/i, "");
        if (!token) {
            setRefetchError("Enter your Gnosis Pay bearer token.");
            return;
        }

        setRefetching(true);
        setRefetchError("");
        try {
            await refetch(evmAddresses, token);
            setGnosisPayToken("");
            setRefetchDialogOpen(false);
        } catch (error) {
            const responseData = axios.isAxiosError(error) ? error.response?.data : null;
            const message =
                responseData?.details ||
                responseData?.error ||
                (error instanceof Error ? error.message : null) ||
                "Transaction refetch failed";
            setRefetchError(typeof message === "string" ? message : JSON.stringify(message));
        } finally {
            setRefetching(false);
        }
    };

    const evmAddresses = useMemo(
        () => wallets.filter((wallet) => wallet.chain === "evm").map((wallet) => wallet.wallet),
        [wallets]
    );

    const filteredTransactionsByDate = useMemo(
        () => filterByDateRange(transactions, "date", startDate, endDate),
        [endDate, startDate, transactions]
    );

    const filteredGnosisTransactionsByDate = useMemo(
        () => filterByDateRange(gnosisTransactions, "date", startDate, endDate),
        [endDate, gnosisTransactions, startDate]
    );

    const formattedGnosisTransactions = useMemo<FormattedGnosisTransaction[]>(
        () =>
            filteredGnosisTransactionsByDate.map((transaction: GnosisTransactionRecord) => ({
                orderNo: transaction.orderNo,
                createdAt: transaction.date,
                transactionAmountFormatted: formatGnosisAmount(transaction.transactionAmount, "CHF"),
                billingAmountFormatted: formatGnosisAmount(transaction.billingAmount, "EUR"),
                merchantFormatted: transaction.merchant || "Unknown",
                status: transaction.status,
                excludedFromTotals: transaction.excludedFromTotals,
            })),
        [filteredGnosisTransactionsByDate]
    );

    const approvedGnosisTransactions = useMemo(
        () => filteredGnosisTransactionsByDate.filter(isApprovedGnosisTransaction),
        [filteredGnosisTransactionsByDate]
    );

    const gnosisSpending = useMemo(
        () => approvedGnosisTransactions.reduce(
            (total, transaction) => total + gnosisAmountChf(transaction),
            0
        ),
        [approvedGnosisTransactions]
    );

    const totals = useMemo(
        () => calculateTransactionTotals(filteredTransactionsByDate, eurToChfRate || 0),
        [eurToChfRate, filteredTransactionsByDate]
    );

    const activityStats = useMemo(() => ({
        includedTransactions:
            filteredTransactionsByDate.filter((transaction) => isIncluded(transaction) && isSuccessful(transaction)).length +
            approvedGnosisTransactions.length,
        cardPayments: approvedGnosisTransactions.length,
        excludedTransactions:
            filteredTransactionsByDate.filter((transaction) => !isIncluded(transaction)).length +
            filteredGnosisTransactionsByDate.filter((transaction) => !isIncluded(transaction)).length,
    }), [approvedGnosisTransactions, filteredGnosisTransactionsByDate, filteredTransactionsByDate]);

    const invalidDateRange = startDate > endDate;

    const handleExclusionChange = async (orderNo: string, excluded: boolean) => {
        setTransactionError("");
        try {
            await updateTransactionExclusion(orderNo, excluded);
        } catch (error) {
            const responseData = axios.isAxiosError(error) ? error.response?.data : null;
            setTransactionError(
                responseData?.error ||
                (error instanceof Error ? error.message : "Failed to update transaction")
            );
        }
    };

    if (loading) {
        return (
            <Container>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container sx={{ marginTop: 10 }}>
            <Button onClick={() => setRefetchDialogOpen(true)}>Refetch</Button>
            {transactionError && (
                <Alert severity="error" sx={{mt: 2}} onClose={() => setTransactionError("")}>
                    {transactionError}
                </Alert>
            )}

            <Dialog open={refetchDialogOpen} onClose={closeRefetchDialog} fullWidth maxWidth="xs">
                <DialogTitle>Refetch transactions</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{mb: 2}}>
                        Enter your Gnosis Pay bearer token. It is used for this refetch only and is not stored.
                    </DialogContentText>
                    {refetchError && <Alert severity="error" sx={{mb: 2}}>{refetchError}</Alert>}
                    <TextField
                        autoFocus
                        fullWidth
                        label="Gnosis Pay bearer token"
                        type="password"
                        value={gnosisPayToken}
                        disabled={refetching}
                        onChange={(event) => setGnosisPayToken(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") handleRefetch();
                        }}
                        autoComplete="off"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeRefetchDialog} disabled={refetching}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleRefetch}
                        disabled={refetching || !gnosisPayToken.trim()}
                    >
                        {refetching ? "Refetching…" : "Refetch"}
                    </Button>
                </DialogActions>
            </Dialog>

            <TransactionCards
                totals={totals}
                gnosisSpending={gnosisSpending}
                activityStats={activityStats}
            />

            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <TextField
                    label="Start Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={startDate}
                    inputProps={{ max: endDate }}
                    onChange={(event) => setStartDate(event.target.value)}
                />
                <TextField
                    label="End Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={endDate}
                    inputProps={{ min: startDate, max: today }}
                    onChange={(event) => setEndDate(event.target.value)}
                />
            </Box>

            {invalidDateRange && <Alert severity="warning" sx={{ mb: 2 }}>Start date must be before the end date.</Alert>}

            <TransactionsTable
                title="Gnosis Pay Transactions"
                transactions={formattedGnosisTransactions}
                columns={gnosisColumns}
                onToggleExcluded={handleExclusionChange}
            />

            <TransactionsTable
                title="Binance, Kraken & Rubic Transactions"
                transactions={filteredTransactionsByDate}
                columns={binanceTransactionColumns}
                onToggleExcluded={handleExclusionChange}
            />
        </Container>
    );
};

export default Transactions;
