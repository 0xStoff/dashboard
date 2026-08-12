import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    InputAdornment,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import apiClient from "../../utils/api-client";

type WindowKey = "5m" | "1h" | "6h" | "24h" | "7d";
type Protocol = "all" | "v2" | "v3" | "v4";

interface PoolWindow {
    swaps: number;
    volumeUsd: number;
    feesUsd: number;
    apy: number | null;
    volumeTvl: number | null;
}

interface PoolRisk {
    level: "low" | "medium" | "high";
    code: string;
    label: string;
}

interface RadarPool {
    id: string;
    version: "v2" | "v3" | "v4";
    address?: string | null;
    feePips?: number | null;
    tickSpacing?: number | null;
    hook?: string | null;
    metrics: {
        tvlUsd?: number | null;
        windows?: Partial<Record<WindowKey, PoolWindow>>;
        lastSwap?: string | null;
        risks?: PoolRisk[];
        freshness?: string;
        dynamicFee?: boolean;
    };
    confidence: string;
}

interface RadarStatus {
    phase: string;
    latestBlock?: number | null;
    indexedThroughBlock?: number | null;
    lastSuccessfulUpdate?: string | null;
    error?: string | null;
    running?: boolean;
    explorerUrl: string;
}

const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-5)}`;
const feeLabel = (pool: RadarPool) => pool.metrics?.dynamicFee ? "Dynamic" : pool.feePips == null ? "—" : `${percent.format(pool.feePips / 10_000)}%`;

const MetricCard: React.FC<{ label: string; value: string; detail: string }> = ({ label, value, detail }) => (
    <Paper sx={{ p: 2, minWidth: 0, background: "linear-gradient(145deg, rgba(23,34,46,.94), rgba(15,23,32,.98))", border: "1px solid rgba(255,255,255,.07)" }}>
        <Typography variant="overline" color="text.secondary" fontWeight={800}>{label}</Typography>
        <Typography variant="h5" fontWeight={800} letterSpacing="-.035em">{value}</Typography>
        <Typography variant="caption" color="text.secondary">{detail}</Typography>
    </Paper>
);

const PoolRadar: React.FC = () => {
    const [pools, setPools] = useState<RadarPool[]>([]);
    const [status, setStatus] = useState<RadarStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [protocol, setProtocol] = useState<Protocol>("all");
    const [windowKey, setWindowKey] = useState<WindowKey>("24h");
    const [minTvl, setMinTvl] = useState(0);

    const load = useCallback(async () => {
        try {
            const { data } = await apiClient.get("/pool-radar");
            setPools(data.pools || []);
            setStatus(data.status || null);
            setError(null);
        } catch (requestError: any) {
            setError(requestError?.response?.data?.error || "Pool Radar API is unavailable.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const timer = window.setInterval(() => void load(), 15_000);
        return () => window.clearInterval(timer);
    }, [load]);

    const visiblePools = useMemo(() => pools
        .filter((pool) => protocol === "all" || pool.version === protocol)
        .filter((pool) => Number(pool.metrics?.tvlUsd || 0) >= minTvl)
        .filter((pool) => !query.trim() || [pool.id, pool.address, pool.hook, pool.version, "eth", "usdg"].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(b.metrics?.windows?.[windowKey]?.apy ?? -1) - Number(a.metrics?.windows?.[windowKey]?.apy ?? -1)),
    [minTvl, pools, protocol, query, windowKey]);

    const totals = useMemo(() => visiblePools.reduce((summary, pool) => {
        const window = pool.metrics?.windows?.[windowKey];
        summary.tvl += Number(pool.metrics?.tvlUsd || 0);
        summary.volume += Number(window?.volumeUsd || 0);
        summary.fees += Number(window?.feesUsd || 0);
        summary.swaps += Number(window?.swaps || 0);
        return summary;
    }, { tvl: 0, volume: 0, fees: 0, swaps: 0 }), [visiblePools, windowKey]);

    const triggerIndex = async () => {
        await apiClient.post("/pool-radar/index");
        setStatus((previous) => previous ? { ...previous, phase: "indexing", running: true } : previous);
        window.setTimeout(() => void load(), 1_000);
    };

    if (loading && !pools.length) return <Box minHeight="65vh" display="grid" sx={{ placeItems: "center" }}><CircularProgress /></Box>;

    return (
        <Box sx={{ width: "100%", minWidth: 0 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2} mb={2.5}>
                <Box>
                    <Typography variant="overline" color="secondary.main" fontWeight={900} letterSpacing={1.8}>ROBINHOOD CHAIN · UNISWAP</Typography>
                    <Typography variant="h3" fontWeight={850} letterSpacing="-.055em">ETH / USDG Pool Radar</Typography>
                    <Typography color="text.secondary">Live LP fee intelligence across v2, v3 and v4. APY is annualized history—not promised yield.</Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Chip color={status?.phase === "live" ? "success" : status?.phase === "error" ? "error" : "warning"} label={status?.phase || "starting"} />
                    <Chip variant="outlined" label={`Block ${status?.latestBlock?.toLocaleString() || "—"}`} />
                    <Button variant="outlined" startIcon={<RefreshIcon />} disabled={Boolean(status?.running)} onClick={triggerIndex}>Refresh index</Button>
                </Stack>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {status?.error && <Alert severity="warning" sx={{ mb: 2 }}>{status.error}</Alert>}

            <Box display="grid" gridTemplateColumns={{ xs: "1fr 1fr", lg: "repeat(4, 1fr)" }} gap={1.5} mb={2}>
                <MetricCard label="TRACKED TVL" value={compactUsd.format(totals.tvl)} detail="Current USDG-side estimate" />
                <MetricCard label={`${windowKey} VOLUME`} value={compactUsd.format(totals.volume)} detail={`${totals.swaps.toLocaleString()} timestamped swaps`} />
                <MetricCard label={`${windowKey} LP FEES`} value={compactUsd.format(totals.fees)} detail="Estimated from effective pool fees" />
                <MetricCard label="POOLS" value={String(visiblePools.length)} detail={`${pools.filter((p) => p.version === "v4").length} v4 pool keys discovered`} />
            </Box>

            <Paper sx={{ p: 1.5, mb: 2, border: "1px solid rgba(255,255,255,.07)" }}>
                <Stack direction={{ xs: "column", md: "row" }} gap={1.25}>
                    <TextField size="small" fullWidth value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pool ID, address, hook…" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                    <FormControl size="small" sx={{ minWidth: 120 }}><Select value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)}>{["all", "v2", "v3", "v4"].map((item) => <MenuItem key={item} value={item}>{item.toUpperCase()}</MenuItem>)}</Select></FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}><Select value={windowKey} onChange={(event) => setWindowKey(event.target.value as WindowKey)}>{["5m", "1h", "6h", "24h", "7d"].map((item) => <MenuItem key={item} value={item}>{item} APY</MenuItem>)}</Select></FormControl>
                    <FormControl size="small" sx={{ minWidth: 150 }}><Select value={minTvl} onChange={(event) => setMinTvl(Number(event.target.value))}><MenuItem value={0}>Any TVL</MenuItem><MenuItem value={10_000}>TVL ≥ $10K</MenuItem><MenuItem value={100_000}>TVL ≥ $100K</MenuItem><MenuItem value={1_000_000}>TVL ≥ $1M</MenuItem></Select></FormControl>
                </Stack>
            </Paper>

            <TableContainer component={Paper} sx={{ border: "1px solid rgba(255,255,255,.07)", backgroundImage: "none" }}>
                <Table size="small">
                    <TableHead><TableRow sx={{ "& th": { color: "text.secondary", fontWeight: 850, whiteSpace: "nowrap" } }}><TableCell>POOL</TableCell><TableCell>VERSION</TableCell><TableCell>FEE</TableCell><TableCell align="right">TVL</TableCell><TableCell align="right">EST. APY</TableCell><TableCell align="right">VOLUME</TableCell><TableCell align="right">LP FEES</TableCell><TableCell align="right">SWAPS</TableCell><TableCell>RISK</TableCell></TableRow></TableHead>
                    <TableBody>
                        {visiblePools.map((pool) => {
                            const window = pool.metrics?.windows?.[windowKey];
                            const target = pool.version === "v4" ? `${status?.explorerUrl}/address/${pool.address}` : `${status?.explorerUrl}/address/${pool.address || pool.id}`;
                            return <TableRow key={pool.id} hover sx={{ "& td": { py: 1.35, borderColor: "rgba(255,255,255,.055)" } }}>
                                <TableCell><Stack direction="row" alignItems="center" gap={1}><Box><Typography fontWeight={800}>ETH / USDG</Typography><Tooltip title={pool.id}><Typography variant="caption" color="text.secondary" fontFamily="monospace">{short(pool.id)}</Typography></Tooltip></Box><OpenInNewIcon component="a" href={target} target="_blank" rel="noreferrer" sx={{ fontSize: 15, color: "text.secondary" }} /></Stack></TableCell>
                                <TableCell><Chip size="small" label={pool.version.toUpperCase()} color={pool.version === "v4" ? "secondary" : "default"} /></TableCell>
                                <TableCell>{feeLabel(pool)}</TableCell>
                                <TableCell align="right">{pool.metrics?.tvlUsd == null ? "—" : compactUsd.format(pool.metrics.tvlUsd)}</TableCell>
                                <TableCell align="right"><Tooltip title={window?.apy == null ? "Unavailable until TVL and timestamped fees are both indexed" : `${compactUsd.format(window.feesUsd)} fees ÷ ${compactUsd.format(pool.metrics.tvlUsd || 0)} TVL, annualized from ${windowKey}`}><Typography fontWeight={850} color={window?.apy != null && window.apy > 25 ? "success.main" : "text.primary"}>{window?.apy == null ? "—" : `${percent.format(window.apy)}%`}</Typography></Tooltip></TableCell>
                                <TableCell align="right">{compactUsd.format(window?.volumeUsd || 0)}</TableCell>
                                <TableCell align="right">{compactUsd.format(window?.feesUsd || 0)}</TableCell>
                                <TableCell align="right">{(window?.swaps || 0).toLocaleString()}</TableCell>
                                <TableCell>{pool.metrics?.risks?.length ? <Stack direction="row" gap={0.5} flexWrap="wrap">{pool.metrics.risks.slice(0, 2).map((risk) => <Chip key={risk.code} size="small" color={risk.level === "high" ? "error" : risk.level === "medium" ? "warning" : "default"} label={risk.label} />)}</Stack> : <Chip size="small" variant="outlined" color="success" label="No rule flags" />}</TableCell>
                            </TableRow>;
                        })}
                        {!visiblePools.length && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 7 }}><Typography color="text.secondary">Verified pool discovery is still backfilling, or no pools match these filters.</Typography></TableCell></TableRow>}
                    </TableBody>
                </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" display="block" mt={1.25}>Estimated LP fee APY = observed LP fees ÷ current estimated TVL × annualization factor. Short windows can be extremely noisy. No wallet addresses are collected by this indexer.</Typography>
        </Box>
    );
};

export default PoolRadar;
