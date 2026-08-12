import React, { useMemo, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    TextField,
    Typography,
    useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import TransactionsTable from "./TransactionsTable";
import TransactionCards from "./TransactionCards";
import useFetchTransactions from "../../hooks/useFetchTransactions";
import { useWallets } from "../../context/WalletsContext";
import { ActivityTableRow, TableColumn } from "../../interfaces";
import { toFixedString } from "../../utils/number-utils";

const activityColumns: TableColumn<ActivityTableRow>[] = [
    { label: "Date", key: "date" },
    { label: "Source", key: "exchange" },
    { label: "Type", key: "type" },
    { label: "Merchant", key: "merchantFormatted" },
    { label: "Asset", key: "asset" },
    { label: "Amount", key: "amount" },
    { label: "Billing", key: "billingAmountFormatted" },
    { label: "Fee", key: "feeFormatted" },
    { label: "Status", key: "status" },
];

const isSameDayOrAfter = (itemDate: Date, startDate: Date) => itemDate >= startDate;
const isSameDayOrBefore = (itemDate: Date, endDate: Date) => itemDate <= endDate;

const toDateInputValue = (value: Date) => value.toISOString().split("T")[0];
const toCurrencyString = (value: number, suffix: string) => `${toFixedString(value)} ${suffix}`;

const normalizeQueryValue = (value: string | null | undefined) => (value || "").toLowerCase();

const Transactions = () => {
    const { transactions, loading, rubicXmrSum, rubicLoading, refetch } = useFetchTransactions();
    const [startDate, setStartDate] = useState(new Date("2020-01-01"));
    const [endDate, setEndDate] = useState(new Date());
    const [selectedExchange, setSelectedExchange] = useState<string>("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [query, setQuery] = useState("");

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const { wallets } = useWallets();

    const evmAddresses = useMemo(
        () => wallets.filter((wallet) => wallet.chain === "evm").map((wallet) => wallet.wallet),
        [wallets]
    );

    const exchanges = useMemo(
        () => ["all", ...new Set(transactions.map((transaction) => transaction.exchange).filter(Boolean))],
        [transactions]
    );

    const statuses = useMemo(
        () => ["all", ...new Set(transactions.map((transaction) => transaction.status).filter(Boolean))],
        [transactions]
    );

    const filteredTransactions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return transactions.filter((transaction) => {
            const transactionDate = new Date(transaction.date);
            const withinDateRange =
                isSameDayOrAfter(transactionDate, startDate) && isSameDayOrBefore(transactionDate, endDate);
            const matchesExchange = selectedExchange === "all" || transaction.exchange === selectedExchange;
            const matchesStatus = selectedStatus === "all" || transaction.status === selectedStatus;
            const haystack = [
                transaction.exchange,
                transaction.type,
                transaction.asset,
                transaction.merchant,
                transaction.reference,
                transaction.status,
            ]
                .map(normalizeQueryValue)
                .join(" ");
            const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);

            return withinDateRange && matchesExchange && matchesStatus && matchesQuery;
        });
    }, [endDate, query, selectedExchange, selectedStatus, startDate, transactions]);

    const activityRows = useMemo<ActivityTableRow[]>(
        () =>
            filteredTransactions.map((transaction) => ({
                date: transaction.date,
                exchange: transaction.exchange,
                type: transaction.type,
                merchantFormatted: transaction.merchant || "-",
                asset: transaction.asset || "-",
                amount:
                    transaction.exchange === "Gnosis Pay"
                        ? toCurrencyString(Number(transaction.chf_value || transaction.amount) / 100, "CHF")
                        : transaction.asset
                          ? `${toFixedString(transaction.amount)} ${transaction.asset}`
                          : toFixedString(transaction.amount),
                billingAmountFormatted:
                    transaction.billingAmount != null
                        ? toCurrencyString(Number(transaction.billingAmount) / 100, "EUR")
                        : "-",
                feeFormatted:
                    transaction.fee > 0
                        ? transaction.asset
                            ? `${toFixedString(transaction.fee)} ${transaction.asset}`
                            : toFixedString(transaction.fee)
                        : "-",
                status: transaction.status,
            })),
        [filteredTransactions]
    );

    const gnosisApprovedSum = useMemo(
        () =>
            filteredTransactions
                .filter((transaction) => transaction.exchange === "Gnosis Pay" && transaction.status === "Approved")
                .reduce((sum, transaction) => sum + (Number(transaction.chf_value) || 0), 0) / 100,
        [filteredTransactions]
    );

    const cashFlowTransactions = useMemo(
        () => filteredTransactions.filter((transaction) => transaction.exchange !== "Gnosis Pay"),
        [filteredTransactions]
    );

    const totalFees = useMemo(
        () => cashFlowTransactions.reduce((sum, transaction) => sum + (Number(transaction.fee) || 0), 0),
        [cashFlowTransactions]
    );

    const sourceSummary = useMemo(() => {
        const totals = filteredTransactions.reduce<Record<string, { count: number }>>((acc, transaction) => {
            const source = transaction.exchange;
            if (!acc[source]) {
                acc[source] = { count: 0 };
            }

            acc[source].count += 1;
            return acc;
        }, {});

        return Object.entries(totals).sort((left, right) => right[1].count - left[1].count);
    }, [filteredTransactions]);

    if (loading) {
        return (
            <Container>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container sx={{ marginTop: 10 }}>
            <Button onClick={() => refetch(evmAddresses)}>Refetch Activity</Button>

            <TransactionCards
                transactions={cashFlowTransactions}
                approvedSum={gnosisApprovedSum}
                totalFees={totalFees}
                rubicXmrSum={rubicXmrSum}
                rubicLoading={rubicLoading}
            />

            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <TextField
                    label="Start Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={toDateInputValue(startDate)}
                    onChange={(event) => setStartDate(new Date(event.target.value))}
                />
                <TextField
                    label="End Date"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={toDateInputValue(endDate)}
                    onChange={(event) => setEndDate(new Date(event.target.value))}
                />
                <TextField
                    label="Search Activity"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    sx={{ minWidth: { xs: "100%", md: 260 } }}
                />
            </Box>

            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Source Filter
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {exchanges.map((exchange) => (
                        <Chip
                            key={exchange}
                            label={exchange}
                            clickable
                            color={selectedExchange === exchange ? "primary" : "default"}
                            variant={selectedExchange === exchange ? "filled" : "outlined"}
                            onClick={() => setSelectedExchange(exchange)}
                        />
                    ))}
                </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Status Filter
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {statuses.map((status) => (
                        <Chip
                            key={status}
                            label={status}
                            clickable
                            color={selectedStatus === status ? "primary" : "default"}
                            variant={selectedStatus === status ? "filled" : "outlined"}
                            onClick={() => setSelectedStatus(status)}
                        />
                    ))}
                </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Activity Sources
                </Typography>
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                    {sourceSummary.map(([source, summary]) => (
                        <Chip
                            key={source}
                            label={`${source}: ${summary.count}`}
                            variant="outlined"
                            onClick={() => setSelectedExchange(source)}
                        />
                    ))}
                </Box>
            </Box>

            {!isMobile ? (
                <TransactionsTable
                    title={`All Activity (${activityRows.length})`}
                    transactions={activityRows}
                    columns={activityColumns}
                />
            ) : (
                <Box sx={{ display: "grid", gap: 2 }}>
                    <Typography variant="h5">All Activity ({activityRows.length})</Typography>
                    {activityRows.map((row, index) => (
                        <Box
                            key={`${row.date}-${row.exchange}-${index}`}
                            sx={{
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 3,
                                padding: 2,
                            }}
                        >
                            <Typography fontWeight="bold">{row.exchange}</Typography>
                            <Typography variant="body2">{new Date(row.date).toLocaleString("de-CH")}</Typography>
                            <Typography variant="body2">{row.type}</Typography>
                            <Typography variant="body2">{row.merchantFormatted}</Typography>
                            <Typography variant="body2">{row.amount}</Typography>
                            <Typography variant="body2">Status: {row.status}</Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {!activityRows.length && (
                <Typography sx={{ mt: 3 }} color="text.secondary">
                    No activity matches the current filters.
                </Typography>
            )}
        </Container>
    );
};

export default Transactions;
