import React, { useMemo, useState } from "react";
import {
    Add,
    ArrowDownward,
    ArrowUpward,
    Close,
    DeleteOutline,
    InfoOutlined,
    PaymentsOutlined,
    TrendingDown,
    TrendingUp,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceDot,
    ResponsiveContainer,
    Tooltip as ChartTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { CapitalFlow, NetWorthData, NewCapitalFlow } from "../../interfaces";
import { useCapitalFlows } from "../../hooks/useCapitalFlows";
import { formatNumber, toFixedString } from "../../utils/number-utils";

const ROBINHOOD_CHAIN_ID = "hood";

interface HistoryPoint {
    date: string;
    portfolioValue: number;
    netInvested: number;
}

const day = (value: string | Date) => new Date(value).toISOString().slice(0, 10);

const robinhoodValue = (snapshot: NetWorthData) => {
    const tokenValue = (snapshot.tokenHistory || [])
        .filter((token) => token.chain_id === ROBINHOOD_CHAIN_ID)
        .reduce((sum, token) => sum + (Number(token.total_usd_value) || 0), 0);
    const protocolValue = (snapshot.protocolHistory || []).reduce(
        (sum, protocol) =>
            sum +
            (protocol.positions || [])
                .filter((position) => position.chain === ROBINHOOD_CHAIN_ID)
                .reduce((positionSum, position) => positionSum + (Number(position.usdValue) || 0), 0),
        0
    );
    return tokenValue + protocolValue;
};

const investedAt = (flows: CapitalFlow[], date: string) =>
    flows.reduce((total, flow) => {
        if (day(flow.occurredAt) > date) return total;
        return total + (flow.type === "deposit" ? flow.usdValue : -flow.usdValue);
    }, 0);

const buildHistory = (
    history: NetWorthData[],
    flows: CapitalFlow[],
    currentValue: number
): HistoryPoint[] => {
    const snapshots = new Map<string, number>();
    history.forEach((snapshot) => snapshots.set(day(snapshot.date), robinhoodValue(snapshot)));
    const today = day(new Date());
    snapshots.set(today, currentValue);

    const allDates = new Set([
        ...Array.from(snapshots.keys()),
        ...flows.map((flow) => day(flow.occurredAt)),
    ]);
    const sortedDates = Array.from(allDates).sort();
    let lastPortfolioValue = 0;

    return sortedDates.map((date) => {
        if (snapshots.has(date)) lastPortfolioValue = snapshots.get(date) || 0;
        return { date, portfolioValue: lastPortfolioValue, netInvested: investedAt(flows, date) };
    });
};

const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);

const FlowDialog: React.FC<{
    open: boolean;
    onClose: () => void;
    onSave: (flow: NewCapitalFlow) => Promise<void>;
}> = ({ open, onClose, onSave }) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        type: "deposit" as "deposit" | "withdrawal",
        asset: "ETH",
        amount: "",
        usdValue: "",
        occurredAt: new Date().toISOString().slice(0, 10),
        source: "",
        txHash: "",
        note: "",
    });

    const submit = async () => {
        setError("");
        const amount = Number(form.amount);
        const usdValue = Number(form.usdValue);
        if (!(amount > 0) || !(usdValue >= 0) || !form.occurredAt) {
            setError("Add a valid amount, USD value and date.");
            return;
        }

        setSaving(true);
        try {
            await onSave({
                scopeChainId: ROBINHOOD_CHAIN_ID,
                type: form.type,
                asset: form.asset,
                amount,
                usdValue,
                occurredAt: new Date(`${form.occurredAt}T12:00:00Z`).toISOString(),
                source: form.source || null,
                txHash: form.txHash || null,
                note: form.note || null,
            });
            onClose();
            setForm((current) => ({ ...current, amount: "", usdValue: "", txHash: "", note: "" }));
        } catch (saveError: any) {
            setError(saveError?.response?.data?.error || "Could not save this capital flow.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Add capital movement
                <IconButton onClick={onClose} size="small" aria-label="Close">
                    <Close fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Typography color="text.secondary" variant="body2" mb={2.5}>
                    Only money crossing into or out of Robinhood belongs here. Swaps and transfers
                    within Robinhood are ignored.
                </Typography>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 2,
                    }}
                >
                    <TextField
                        select
                        label="Movement"
                        value={form.type}
                        onChange={(event) =>
                            setForm({ ...form, type: event.target.value as "deposit" | "withdrawal" })
                        }
                    >
                        <MenuItem value="deposit">Deposit</MenuItem>
                        <MenuItem value="withdrawal">Withdrawal</MenuItem>
                    </TextField>
                    <TextField
                        label="Date"
                        type="date"
                        value={form.occurredAt}
                        onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="Asset"
                        value={form.asset}
                        onChange={(event) => setForm({ ...form, asset: event.target.value.toUpperCase() })}
                        placeholder="ETH"
                    />
                    <TextField
                        label="Amount"
                        type="number"
                        value={form.amount}
                        onChange={(event) => setForm({ ...form, amount: event.target.value })}
                        inputProps={{ min: 0, step: "any" }}
                    />
                    <TextField
                        label="USD value when moved"
                        type="number"
                        value={form.usdValue}
                        onChange={(event) => setForm({ ...form, usdValue: event.target.value })}
                        inputProps={{ min: 0, step: "0.01" }}
                        sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                        label="From / destination"
                        value={form.source}
                        onChange={(event) => setForm({ ...form, source: event.target.value })}
                        placeholder="Ethereum, Arbitrum, another wallet…"
                        sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                        label="Transaction hash (optional)"
                        value={form.txHash}
                        onChange={(event) => setForm({ ...form, txHash: event.target.value })}
                        sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                    <TextField
                        label="Note (optional)"
                        value={form.note}
                        onChange={(event) => setForm({ ...form, note: event.target.value })}
                        sx={{ gridColumn: { sm: "1 / -1" } }}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button onClick={submit} disabled={saving} variant="contained">
                    {saving ? "Saving…" : "Add movement"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const FlowListDialog: React.FC<{
    flows: CapitalFlow[];
    open: boolean;
    onClose: () => void;
    onAdd: () => void;
    onRemove: (id: number) => Promise<void>;
}> = ({ flows, open, onClose, onAdd, onRemove }) => (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Capital movements
            <IconButton onClick={onClose} size="small" aria-label="Close">
                <Close fontSize="small" />
            </IconButton>
        </DialogTitle>
        <DialogContent>
            <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2.5 }}>
                These movements define invested capital. Trading activity never changes this total.
            </Alert>
            {!flows.length ? (
                <Box sx={{ py: 5, textAlign: "center" }}>
                    <PaymentsOutlined color="primary" sx={{ fontSize: 38 }} />
                    <Typography fontWeight={750} mt={1}>No capital movements yet</Typography>
                    <Typography color="text.secondary" variant="body2" mt={0.5}>
                        Add your first external deposit to start measuring performance.
                    </Typography>
                </Box>
            ) : (
                <Stack divider={<Divider flexItem />}>
                    {[...flows].reverse().map((flow) => (
                        <Box key={flow.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.5 }}>
                            <Box
                                sx={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 2.5,
                                    display: "grid",
                                    placeItems: "center",
                                    color: flow.type === "deposit" ? "success.main" : "error.main",
                                    bgcolor:
                                        flow.type === "deposit"
                                            ? "rgba(93,228,168,.09)"
                                            : "rgba(255,112,133,.09)",
                                }}
                            >
                                {flow.type === "deposit" ? <ArrowDownward /> : <ArrowUpward />}
                            </Box>
                            <Box minWidth={0} flex={1}>
                                <Typography fontWeight={700}>
                                    {flow.type === "deposit" ? "Deposit" : "Withdrawal"} · {flow.amount} {flow.asset}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    {new Date(flow.occurredAt).toLocaleDateString("de-CH")}
                                    {flow.source ? ` · ${flow.source}` : ""}
                                    {flow.note ? ` · ${flow.note}` : ""}
                                </Typography>
                            </Box>
                            <Typography fontWeight={750} whiteSpace="nowrap">
                                {flow.type === "deposit" ? "+" : "−"}{money(flow.usdValue)}
                            </Typography>
                            <Tooltip title="Remove movement">
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => void onRemove(flow.id)}
                                    aria-label="Remove capital movement"
                                >
                                    <DeleteOutline fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                </Stack>
            )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={onAdd} startIcon={<Add />} variant="contained">Add movement</Button>
        </DialogActions>
    </Dialog>
);

const Metric: React.FC<{
    label: string;
    value: string;
    detail: string;
    tone?: "positive" | "negative" | "neutral";
    onClick?: () => void;
}> = ({ label, value, detail, tone = "neutral", onClick }) => (
    <Box
        component={onClick ? "button" : "div"}
        onClick={onClick}
        sx={{
            appearance: "none",
            textAlign: "left",
            color: "inherit",
            bgcolor: "transparent",
            border: 0,
            p: 0,
            cursor: onClick ? "pointer" : "default",
        }}
    >
        <Typography variant="overline" color="text.secondary" fontWeight={750} letterSpacing={1}>
            {label}
        </Typography>
        <Typography
            variant="h5"
            mt={0.15}
            sx={{
                color:
                    tone === "positive"
                        ? "success.main"
                        : tone === "negative"
                          ? "error.main"
                          : "text.primary",
            }}
        >
            {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Box>
);

const CapitalPerformance: React.FC<{
    currentValue: number;
    netWorthHistory: NetWorthData[];
}> = ({ currentValue, netWorthHistory }) => {
    const { flows, loading, error, addFlow, removeFlow } = useCapitalFlows(ROBINHOOD_CHAIN_ID);
    const [showLedger, setShowLedger] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [showChart, setShowChart] = useState(false);

    const totals = useMemo(() => {
        const deposits = flows
            .filter((flow) => flow.type === "deposit")
            .reduce((sum, flow) => sum + flow.usdValue, 0);
        const withdrawals = flows
            .filter((flow) => flow.type === "withdrawal")
            .reduce((sum, flow) => sum + flow.usdValue, 0);
        const netInvested = deposits - withdrawals;
        const pnl = currentValue + withdrawals - deposits;
        return { deposits, withdrawals, netInvested, pnl, returnPct: netInvested > 0 ? (pnl / netInvested) * 100 : 0 };
    }, [currentValue, flows]);

    const chartData = useMemo(
        () => buildHistory(netWorthHistory, flows, currentValue),
        [currentValue, flows, netWorthHistory]
    );
    const hasBasis = flows.length > 0;
    const pnlTone = totals.pnl >= 0 ? "positive" : "negative";
    const PnlIcon = totals.pnl >= 0 ? TrendingUp : TrendingDown;

    return (
        <>
            <Card
                sx={{
                    mt: 2.5,
                    overflow: "hidden",
                    background:
                        "radial-gradient(circle at 10% 0%, rgba(139,124,255,.13), transparent 36%), linear-gradient(145deg, rgba(255,255,255,.035), transparent 58%)",
                }}
            >
                <Box sx={{ p: { xs: 2.25, md: 3 } }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: { xs: "flex-start", sm: "center" },
                            gap: 2,
                            mb: 2.5,
                        }}
                    >
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography variant="h5">Robinhood performance</Typography>
                                <Chip label="Account view" size="small" variant="outlined" />
                            </Box>
                            <Typography color="text.secondary" variant="body2" mt={0.35}>
                                Capital in versus what the whole Robinhood account is worth
                            </Typography>
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                            justifyContent="flex-end"
                        >
                            <Button
                                color="inherit"
                                variant="outlined"
                                onClick={() => setShowChart((value) => !value)}
                            >
                                {showChart ? "Hide history" : "View history"}
                            </Button>
                            <Button startIcon={<Add />} variant="contained" onClick={() => setShowAdd(true)}>
                                Add flow
                            </Button>
                        </Stack>
                    </Box>

                    {error && <Alert severity="warning" sx={{ mb: 2 }}>Capital movements could not be loaded.</Alert>}

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" },
                            gap: { xs: 2.5, md: 3 },
                        }}
                    >
                        <Metric
                            label="CURRENT VALUE"
                            value={money(currentValue)}
                            detail="All tracked Robinhood assets"
                        />
                        <Metric
                            label="NET DEPOSITED"
                            value={loading ? "…" : hasBasis ? money(totals.netInvested) : "Not set"}
                            detail={hasBasis ? `${flows.length} capital movement${flows.length === 1 ? "" : "s"} · inspect` : "Add deposits to establish cost"}
                            onClick={() => setShowLedger(true)}
                        />
                        <Metric
                            label="TOTAL P&L"
                            value={hasBasis ? `${totals.pnl >= 0 ? "+" : "−"}${money(Math.abs(totals.pnl))}` : "—"}
                            detail={hasBasis ? "After deposits and withdrawals" : "Waiting for capital history"}
                            tone={hasBasis ? pnlTone : "neutral"}
                        />
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box
                                sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 2.5,
                                    display: "grid",
                                    placeItems: "center",
                                    color: hasBasis
                                        ? totals.pnl >= 0
                                            ? "success.main"
                                            : "error.main"
                                        : "text.secondary",
                                    bgcolor: "rgba(255,255,255,.035)",
                                }}
                            >
                                <PnlIcon />
                            </Box>
                            <Metric
                                label="RETURN"
                                value={
                                    hasBasis
                                        ? `${totals.returnPct >= 0 ? "+" : ""}${toFixedString(totals.returnPct, 1)}%`
                                        : "—"
                                }
                                detail="Since first tracked deposit"
                                tone={hasBasis ? pnlTone : "neutral"}
                            />
                        </Box>
                    </Box>
                </Box>

                {showChart && (
                    <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: { xs: 2, md: 3 }, pt: 2 }}>
                        {!hasBasis ? (
                            <Box sx={{ minHeight: 230, display: "grid", placeItems: "center", textAlign: "center" }}>
                                <Box>
                                    <Typography fontWeight={750}>Add deposits to unlock performance history</Typography>
                                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                                        Portfolio history already exists; it only needs its invested-capital baseline.
                                    </Typography>
                                    <Button sx={{ mt: 2 }} onClick={() => setShowAdd(true)} variant="outlined">
                                        Add first deposit
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Stack direction="row" spacing={2.5} mb={1.5}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                        <Box sx={{ width: 18, height: 3, borderRadius: 2, bgcolor: "primary.main" }} />
                                        <Typography variant="caption" color="text.secondary">Portfolio value</Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                        <Box sx={{ width: 18, height: 3, borderRadius: 2, bgcolor: "secondary.main" }} />
                                        <Typography variant="caption" color="text.secondary">Net invested</Typography>
                                    </Box>
                                </Stack>
                                <Box sx={{ height: { xs: 280, md: 350 } }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 2 }}>
                                            <defs>
                                                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b7cff" stopOpacity={0.22} />
                                                    <stop offset="100%" stopColor="#8b7cff" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(value) =>
                                                    new Date(value).toLocaleDateString("de-CH", { month: "short", day: "2-digit" })
                                                }
                                                tick={{ fill: "#969cad", fontSize: 12 }}
                                                tickLine={false}
                                                axisLine={{ stroke: "rgba(255,255,255,.1)" }}
                                            />
                                            <YAxis
                                                tickFormatter={(value) => `$${formatNumber(value, "axis")}`}
                                                tick={{ fill: "#969cad", fontSize: 12 }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={64}
                                            />
                                            <ChartTooltip
                                                cursor={{ stroke: "rgba(184,175,255,.4)" }}
                                                content={({ active, payload, label }) => {
                                                    if (!active || !payload?.length) return null;
                                                    const portfolio = payload.find(
                                                        (entry) => entry.dataKey === "portfolioValue"
                                                    );
                                                    const invested = payload.find(
                                                        (entry) => entry.dataKey === "netInvested"
                                                    );
                                                    return (
                                                        <Card sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(18,21,31,.94)" }}>
                                                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                                                            <Typography fontWeight={750}>
                                                                {money(Number(portfolio?.value) || 0)}
                                                            </Typography>
                                                            <Typography variant="body2" color="secondary.main">
                                                                {money(Number(invested?.value) || 0)} invested
                                                            </Typography>
                                                        </Card>
                                                    );
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="portfolioValue"
                                                stroke="none"
                                                fill="url(#portfolioFill)"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="portfolioValue"
                                                stroke="#8b7cff"
                                                strokeWidth={2.7}
                                                dot={false}
                                                activeDot={{ r: 5 }}
                                            />
                                            <Line
                                                type="stepAfter"
                                                dataKey="netInvested"
                                                stroke="#5de4c7"
                                                strokeWidth={2.2}
                                                strokeDasharray="6 5"
                                                dot={false}
                                            />
                                            {flows.map((flow) => (
                                                <ReferenceDot
                                                    key={flow.id}
                                                    x={day(flow.occurredAt)}
                                                    y={investedAt(flows, day(flow.occurredAt))}
                                                    r={4}
                                                    fill={flow.type === "deposit" ? "#5de4c7" : "#ff7085"}
                                                    stroke="#12151f"
                                                />
                                            ))}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </Box>
                            </>
                        )}
                    </Box>
                )}
            </Card>

            <FlowDialog open={showAdd} onClose={() => setShowAdd(false)} onSave={addFlow} />
            <FlowListDialog
                flows={flows}
                open={showLedger}
                onClose={() => setShowLedger(false)}
                onAdd={() => {
                    setShowLedger(false);
                    setShowAdd(true);
                }}
                onRemove={removeFlow}
            />
        </>
    );
};

export default React.memo(CapitalPerformance);
