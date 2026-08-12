import React, { useEffect, useState } from "react";
import {
    ExpandMoreRounded,
    RefreshRounded,
    TrendingDown,
    TrendingUp,
} from "@mui/icons-material";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Drawer,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    LinearProgress,
    MenuItem,
    Select,
    Stack,
    Switch,
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
import {
    useRobinhoodPerformance,
    type LpLifecycleEvent,
    type LpLifecyclePosition,
    type RobinhoodTransactionClassification,
} from "../../hooks/useRobinhoodPerformance";
import { buildLogoUrl } from "../../config/env";

const eth = (value: unknown) =>
    `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 5 })} ETH`;
const usd = (value: unknown) =>
    Number(value || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    });
const signedUsd = (value: unknown) => {
    const amount = Number(value || 0);
    return `${amount >= 0 ? "+" : "−"}${usd(Math.abs(amount))}`;
};
const pnlColor = (value: unknown) => (Number(value || 0) >= 0 ? "success.main" : "error.main");
const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const shortContract = (contract: unknown) => `${String(contract || "").slice(0, 6)}…`;
const shortWallet = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
const compactUsd = (value: unknown) =>
    Number(value || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
    });
const shortDateTime = (value: string | undefined) => {
    if (!value) return "unknown time";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "unknown time"
        : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const RECONCILIATION_DUST_USD = 1;
const RECONCILIATION_DUST_ETH = 0.0005;
const MIN_POSITION_VALUE_USD = 1;

const ASSET_LOGOS: Record<string, string> = {
    ETH: "ETH.png",
    WETH: "ETH.png",
    UNI: "uni.png",
    LINK: "chainlink.png",
};

const logoUrl = (path?: string | null) => {
    if (!path) return "";
    if (/^(?:https?:|data:)/i.test(path)) return path;
    return buildLogoUrl(path.replace(/^\/?logos\//i, "").replace(/^\//, ""));
};

const AssetMark = ({ symbol, size = 28, logoPath }: { symbol: string; size?: number; logoPath?: string | null }) => {
    const normalized = String(symbol || "?").toUpperCase();
    const initials = normalized.replace(/[^A-Z0-9]/g, "").slice(0, 2) || "?";
    const src = logoUrl(logoPath || ASSET_LOGOS[normalized]);
    return <Avatar alt={symbol} src={src || undefined} sx={{ width: size, height: size, fontSize: size * 0.34, fontWeight: 800, bgcolor: src ? "transparent" : "rgba(139,124,255,.22)", color: "primary.light", border: "1px solid rgba(255,255,255,.12)" }}>{initials}</Avatar>;
};

const PairMarks = ({ assets, size = 28 }: { assets: Array<{ symbol: string; logoPath?: string | null }>; size?: number }) => (
    <Box sx={{ display: "flex", alignItems: "center", minWidth: size + 8 }}>
        {assets.slice(0, 3).map((asset, index) => <Box key={`${asset.symbol}-${index}`} sx={{ ml: index ? -0.8 : 0, border: "2px solid", borderColor: "background.paper", borderRadius: "50%", lineHeight: 0 }}><AssetMark symbol={asset.symbol} logoPath={asset.logoPath} size={size} /></Box>)}
    </Box>
);

type LedgerRow = Record<string, any> & {
    balance: number;
    currentValueUsd: number | null;
    displayValueUsd: number | null;
    investedUsd: number;
    totalPnlUsd: number | null;
    returnPercentage: number | null;
    isClosed: boolean;
    displaySymbol: string;
    timeline?: Array<{
        kind?: string;
        timestamp?: string;
        transactionUrl?: string;
        hash?: string;
        quantity?: number;
        ethAmount?: number;
    }>;
    openedAt?: string | null;
    closedAt?: string | null;
};

type LiquidityPosition = {
    id: string;
    positionId?: string | null;
    walletTag: string;
    protocol: string;
    chain: string;
    name: string;
    kind: "LP" | "Protocol";
    currentValueUsd: number;
    pricing: { method: string; confidence: string; source: string };
    assets: Array<{ contract: string; symbol: string; name: string; amount: number; price: number; usdValue: number; logoPath?: string | null }>;
    range: null;
    feesEarnedUsd: null;
    initialDepositUsd: null;
    underlyingPositions?: LiquidityPosition[];
};

type LpLedgerRow = LpLifecyclePosition & {
    pair: string;
    currentValueUsd: number | null;
    pnlUsd: number | null;
    returnPercent: number | null;
    positionIds?: string[];
    incompletePositionCount?: number;
    strategy?: boolean;
};

const canonicalPairSymbols = (symbols: string[]) => Array.from(new Set(symbols
    .map((symbol) => String(symbol || "").trim().toUpperCase())
    .filter(Boolean)
    .map((symbol) => symbol === "WETH" ? "ETH" : symbol)))
    .sort((left, right) => {
        const priority = (symbol: string) => symbol === "ETH" ? 0 : symbol === "USDG" ? 2 : 1;
        return priority(left) - priority(right) || left.localeCompare(right);
    });

const canonicalPairKey = (symbols: string[]) => canonicalPairSymbols(symbols).join("/");
const canonicalPairLabel = (symbols: string[]) => canonicalPairSymbols(symbols).join(" / ");

const positionOutcome = (row: LedgerRow) => {
    if (row.totalPnlUsd == null) return "unavailable";
    if (row.totalPnlUsd > 0.005) return "profit";
    if (row.totalPnlUsd < -0.005) return "loss";
    return "flat";
};

const PositionDetails = ({ row, onClose }: { row: LedgerRow | null; onClose: () => void }) => (
    <Drawer anchor="right" open={Boolean(row)} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, p: 0 } }}>
        {row && (
            <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box minWidth={0}>
                        <Typography variant="overline" color="text.secondary" fontWeight={800}>Position details</Typography>
                        <Typography variant="h5" fontWeight={800} noWrap>{row.displaySymbol}</Typography>
                        <Typography color="text.secondary" noWrap>{row.name}</Typography>
                    </Box>
                    <Chip size="small" color={row.isClosed ? "default" : "success"} label={row.isClosed ? "Closed" : "Open"} />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 2.5 }}>
                    {[
                        [row.isClosed ? "Returned" : "Current value", row.displayValueUsd == null ? "Unavailable" : usd(row.displayValueUsd)],
                        ["Invested", row.investedUsd > 0 ? usd(row.investedUsd) : "Unavailable"],
                        ["P&L", row.totalPnlUsd == null ? "Unavailable" : signedUsd(row.totalPnlUsd)],
                        ["Return", row.returnPercentage == null ? "Unavailable" : `${Number(row.returnPercentage) >= 0 ? "+" : ""}${Number(row.returnPercentage).toFixed(1)}%`],
                    ].map(([label, value]) => (
                        <Box key={label} sx={{ p: 1.35, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={750} sx={label === "P&L" && row.totalPnlUsd != null ? { color: pnlColor(row.totalPnlUsd) } : undefined}>{value}</Typography>
                        </Box>
                    ))}
                </Box>

                <Box sx={{ mt: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={800}>Accounting</Typography>
                    <Stack spacing={0.75} mt={1}>
                        <Typography variant="body2" color="text.secondary">Opened: {shortDateTime(row.openedAt || undefined)}</Typography>
                        <Typography variant="body2" color="text.secondary">Closed: {row.isClosed ? shortDateTime(row.closedAt || undefined) : "Still open"}</Typography>
                        <Typography variant="body2" color="text.secondary">Current tracked balance: {eth(row.balance)}</Typography>
                        {row.classification === "developer-lp" && <Typography variant="body2" color="warning.main">LP return includes collected fees, impermanent loss, and gas as one combined result.</Typography>}
                    </Stack>
                </Box>

                <Divider sx={{ my: 2.5 }} />
                <Typography variant="subtitle2" fontWeight={800}>Activity timeline</Typography>
                {!row.timeline?.length ? (
                    <Alert severity="info" sx={{ mt: 1.25 }}>Detailed transaction history is not available for this legacy position.</Alert>
                ) : (
                    <Stack spacing={1} sx={{ mt: 1.25 }}>
                        {row.timeline.map((event, index) => (
                            <Box key={`${event.hash || event.timestamp || "event"}-${index}`} sx={{ pl: 1.4, borderLeft: "2px solid", borderColor: "divider" }}>
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                    <Typography fontWeight={700}>{event.kind || "Activity"}</Typography>
                                    <Typography variant="caption" color="text.secondary">{shortDateTime(event.timestamp)}</Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">{event.quantity != null ? `${Number(event.quantity).toLocaleString("en-US", { maximumFractionDigits: 6 })} tokens` : ""}{event.ethAmount != null ? `${event.quantity != null ? " · " : ""}${eth(event.ethAmount)}` : ""}</Typography>
                                {event.transactionUrl && <Button size="small" component="a" href={event.transactionUrl} target="_blank" rel="noreferrer" sx={{ px: 0, minWidth: 0 }}>View transaction</Button>}
                            </Box>
                        ))}
                    </Stack>
                )}
                <Alert severity="info" sx={{ mt: 2.5 }}>P&L is shown only from the verified Robinhood transaction ledger. Fields without evidence are marked unavailable.</Alert>
            </Box>
        )}
    </Drawer>
);

const LiquidityDetails = ({ position, onClose }: { position: LiquidityPosition | null; onClose: () => void }) => (
    <Drawer anchor="right" open={Boolean(position)} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}>
        {position && <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Stack direction="row" spacing={1.15} alignItems="center"><PairMarks assets={position.assets} size={34} /><Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Live {position.kind} position</Typography><Typography variant="h5" fontWeight={800}>{position.assets.map((asset) => asset.symbol).join(" / ") || position.name}</Typography><Typography color="text.secondary">{position.protocol} · {position.walletTag}</Typography></Box></Stack>
                <Chip size="small" color="success" label="Tracked live" />
            </Stack>
            <Box sx={{ p: 1.5, mt: 2.5, borderRadius: 2, bgcolor: "rgba(85, 225, 166, 0.07)", border: "1px solid rgba(85, 225, 166, 0.16)" }}><Typography variant="caption" color="text.secondary">CURRENT VALUE</Typography><Typography variant="h5" fontWeight={800}>{usd(position.currentValueUsd)}</Typography><Typography variant="caption" color="text.secondary">{position.pricing.source}</Typography></Box>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2.5, mb: 1 }}>Token composition</Typography>
            <Stack spacing={1}>{position.assets.map((asset) => <Box key={asset.contract || asset.symbol} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 1, p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Stack direction="row" spacing={1} minWidth={0} alignItems="center"><AssetMark symbol={asset.symbol} logoPath={asset.logoPath} /><Box minWidth={0}><Typography fontWeight={700}>{asset.symbol}</Typography><Typography variant="caption" color="text.secondary">{Number(asset.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })} tokens</Typography></Box></Stack><Box textAlign="right"><Typography fontWeight={700}>{asset.usdValue > 0 ? usd(asset.usdValue) : "Unpriced"}</Typography><Typography variant="caption" color="text.secondary">{position.currentValueUsd > 0 && asset.usdValue > 0 ? `${((asset.usdValue / position.currentValueUsd) * 100).toFixed(1)}%` : "—"}</Typography></Box></Box>)}</Stack>
            {!!position.underlyingPositions?.length && <>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2.5, mb: 1 }}>Underlying LP NFTs</Typography>
                <Stack spacing={0.75}>{position.underlyingPositions.map((underlying) => <Box key={underlying.id} sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 1, alignItems: "center", p: 1.1, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}><PairMarks assets={underlying.assets} size={24} /><Box minWidth={0}><Typography fontWeight={740}>NFT #{underlying.positionId || underlying.id}</Typography><Typography variant="caption" color="text.secondary" noWrap>{underlying.walletTag} · {underlying.protocol}</Typography></Box><Box textAlign="right"><Typography fontWeight={760}>{usd(underlying.currentValueUsd)}</Typography><Typography variant="caption" color="text.secondary">live</Typography></Box></Box>)}</Stack>
            </>}
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="subtitle2" fontWeight={800}>Position intelligence</Typography>
            <Stack spacing={0.75} mt={1}><Typography variant="body2" color="text.secondary">Chain: {position.chain}</Typography><Typography variant="body2" color="text.secondary">Range status: unavailable from the current provider payload.</Typography><Typography variant="body2" color="text.secondary">Fees earned: unavailable until a position-event source is connected.</Typography><Typography variant="body2" color="text.secondary">Initial deposit: unavailable for positions opened before lifecycle tracking.</Typography></Stack>
            <Alert severity="info" sx={{ mt: 2.5 }}>This shows live provider-backed composition. The dashboard deliberately does not estimate fee income, range bounds, or cost basis without position event data.</Alert>
        </Box>}
    </Drawer>
);

const flowLabel = (event: LpLifecycleEvent, direction: "depositedTokens" | "returnedTokens") => {
    const tokens = event[direction]
        .filter((token) => Number(token.quantity || 0) > 0)
        .map((token) => `${Number(token.quantity).toLocaleString("en-US", { maximumFractionDigits: 5 })} ${token.symbol}`);
    const nativeAmount = direction === "depositedTokens" ? event.nativeDepositEth : event.nativeReturnedEth;
    if (Number(nativeAmount || 0) > 0) tokens.unshift(`${Number(nativeAmount).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`);
    return tokens.length ? tokens.join(" + ") : "No asset flow";
};

const LpLifecycleDetails = ({ row, onClose }: { row: LpLedgerRow | null; onClose: () => void }) => (
    <Drawer anchor="right" open={Boolean(row)} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}>
        {row && <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>{row.strategy ? "Combined LP strategy" : `LP lifecycle #${row.positionId}`}</Typography><Typography variant="h5" fontWeight={800}>{row.pair}</Typography><Typography color="text.secondary">{row.strategy ? `${row.positionIds?.length || 0} position NFTs` : shortWallet(row.wallet)} · Uniswap v4 · Robinhood Chain</Typography></Box>
                <Chip size="small" color={row.status === "open" ? "success" : row.status === "unresolved" ? "warning" : "default"} label={row.status === "open" ? "Open" : row.status === "closed" ? "Closed" : "Needs state"} />
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 2.5 }}>
                {[
                    ["Net invested", row.depositsUsd > 0 ? usd(Math.max(0, row.depositsUsd - row.returnedUsd)) : "Unavailable"],
                    ["Returned / collected", row.returnedUsd > 0 ? usd(row.returnedUsd) : usd(0)],
                    ["Current value", row.currentValueUsd == null ? "Unavailable" : usd(row.currentValueUsd)],
                    ["LP P&L", row.pnlUsd == null ? "Unavailable" : signedUsd(row.pnlUsd)],
                ].map(([label, value]) => <Box key={label} sx={{ p: 1.3, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={760} sx={label === "LP P&L" && row.pnlUsd != null ? { color: pnlColor(row.pnlUsd) } : undefined}>{value}</Typography></Box>)}
            </Box>
            {row.strategy && <Box sx={{ mt: 1.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Gross added {usd(row.depositsUsd)} · returned/collected {usd(row.returnedUsd)} · {row.positionIds?.length || 0} NFTs combined.</Typography>
                <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ display: "block", mt: 1 }}>Underlying positions</Typography>
                <Stack direction="row" spacing={0.65} useFlexGap flexWrap="wrap">
                    {(row.positionIds || []).map((positionId) => <Chip key={positionId} size="small" variant="outlined" label={`#${positionId}`} />)}
                </Stack>
            </Box>}
            <Alert severity={row.valuationStatus === "valued" ? "info" : "warning"} sx={{ mt: 2 }}>
                {row.valuationStatus === "valued"
                    ? "Deposits, returned capital, current value, and gas are kept in this LP ledger—not in token-trading P&L."
                    : row.pnlUsd != null
                        ? "Estimated cash-flow P&L: live value + indexed returns − deposits − gas. Some native transfer history is incomplete, so treat this as provisional."
                        : `${row.incompletePositionCount || "Some"} underlying lifecycle${row.incompletePositionCount === 1 ? " is" : "s are"} missing return data. No loss is assumed.`}
            </Alert>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 2.5 }}>Chronological LP activity</Typography>
            <Stack spacing={1.15} sx={{ mt: 1.25 }}>
                {row.events.map((event, index) => <Box key={`${event.hash}-${index}`} sx={{ pl: 1.5, borderLeft: "2px solid", borderColor: event.type === "reposition" ? "warning.main" : "primary.main" }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={740} sx={{ textTransform: "capitalize" }}>{event.type.replaceAll("-", " ")}</Typography><Typography variant="caption" color="text.secondary">{shortDateTime(event.timestamp || undefined)}</Typography></Stack>
                    {!!(event.nativeDepositUsd + event.tokenDepositUsd) && <Typography variant="body2" color="text.secondary">In: {flowLabel(event, "depositedTokens")} · {usd(event.nativeDepositUsd + event.tokenDepositUsd)}</Typography>}
                    {!!event.returnedUsd && <Typography variant="body2" color="text.secondary">Out: {flowLabel(event, "returnedTokens")} · {usd(event.returnedUsd)}</Typography>}
                    <Typography variant="caption" color="text.secondary">Gas {usd(event.gasUsd)}</Typography>
                    <Button size="small" component="a" href={event.transactionUrl} target="_blank" rel="noreferrer" sx={{ display: "block", px: 0, minWidth: 0, width: "fit-content" }}>View transaction</Button>
                </Box>)}
            </Stack>
        </Box>}
    </Drawer>
);

const TransactionClassifier = ({
    event,
    livePositions,
    existing,
    saving,
    onClose,
    onSave,
    onReset,
}: {
    event: LpLifecycleEvent | null;
    livePositions: LiquidityPosition[];
    existing?: RobinhoodTransactionClassification;
    saving: boolean;
    onClose: () => void;
    onSave: (assignment: Omit<RobinhoodTransactionClassification, "transactionHash" | "updatedAt">) => Promise<void>;
    onReset: () => Promise<void>;
}) => {
    const [classification, setClassification] = useState<RobinhoodTransactionClassification["classification"]>("lp");
    const [lifecycleKey, setLifecycleKey] = useState("");
    const [customKey, setCustomKey] = useState("");
    const [status, setStatus] = useState<"open" | "closed">("open");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        setClassification(existing?.classification || "lp");
        const knownKey = existing?.lifecycleKey || livePositions[0]?.id || "";
        setLifecycleKey(livePositions.some((position) => position.id === knownKey) ? knownKey : knownKey ? "custom" : "");
        setCustomKey(livePositions.some((position) => position.id === knownKey) ? "" : knownKey);
        setStatus(existing?.metadata?.status || "open");
        setNotes(existing?.notes || "");
    }, [event?.hash, existing?.updatedAt, livePositions.length]);

    const resolvedKey = lifecycleKey === "custom" ? customKey.trim() : lifecycleKey;
    return <Drawer anchor="right" open={Boolean(event)} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 460 } } }}>
        {event && <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
            <Typography variant="overline" color="text.secondary" fontWeight={800}>Classify transaction</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ textTransform: "capitalize" }}>{event.type.replaceAll("-", " ")}</Typography>
            <Typography variant="body2" color="text.secondary">{shortDateTime(event.timestamp || undefined)} · {shortWallet(event.wallet)}</Typography>
            <Box sx={{ mt: 1.5, p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}><Typography variant="caption" color="text.secondary">Observed flow</Typography><Typography variant="body2">In: {flowLabel(event, "depositedTokens")}</Typography><Typography variant="body2">Out: {flowLabel(event, "returnedTokens")}</Typography></Box>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
                <FormControl fullWidth size="small"><InputLabel>Classification</InputLabel><Select label="Classification" value={classification} onChange={(change) => setClassification(change.target.value as RobinhoodTransactionClassification["classification"])}><MenuItem value="lp">LP lifecycle</MenuItem><MenuItem value="swap">Swap</MenuItem><MenuItem value="fee-collection">Fee collection</MenuItem><MenuItem value="transfer">Transfer</MenuItem><MenuItem value="ignore">Ignore / duplicate</MenuItem><MenuItem value="unknown">Leave unassigned</MenuItem></Select></FormControl>
                {classification === "lp" && <>
                    <FormControl fullWidth size="small"><InputLabel>Assign to position</InputLabel><Select label="Assign to position" value={lifecycleKey} onChange={(change) => setLifecycleKey(String(change.target.value))}>{livePositions.map((position) => <MenuItem key={position.id} value={position.id}>{position.assets.map((asset) => asset.symbol).join(" / ")} · {position.walletTag} · {usd(position.currentValueUsd)}</MenuItem>)}<MenuItem value="custom">Closed/custom lifecycle…</MenuItem></Select></FormControl>
                    {lifecycleKey === "custom" && <TextField size="small" label="Lifecycle name or ID" value={customKey} onChange={(change) => setCustomKey(change.target.value)} helperText="Use the same name on related mint, reposition, and withdrawal transactions." />}
                    <FormControl fullWidth size="small"><InputLabel>Lifecycle state</InputLabel><Select label="Lifecycle state" value={status} onChange={(change) => setStatus(change.target.value as "open" | "closed")}><MenuItem value="open">Open / still deployed</MenuItem><MenuItem value="closed">Closed / fully withdrawn</MenuItem></Select></FormControl>
                </>}
                <TextField size="small" label="Notes (optional)" multiline minRows={2} value={notes} onChange={(change) => setNotes(change.target.value)} />
            </Stack>
            <Alert severity="info" sx={{ mt: 2 }}>Assignments persist in the database. LP groups reconstruct cash flows and total P&amp;L; swaps and transfers stay labeled for audit without inventing cost basis.</Alert>
            <Stack direction="row" spacing={1} sx={{ mt: 2.25 }}><Button variant="contained" disabled={saving || (classification === "lp" && !resolvedKey)} onClick={async () => { await onSave({ classification, lifecycleKey: classification === "lp" ? resolvedKey : null, label: classification === "lp" && lifecycleKey === "custom" ? customKey.trim() : null, notes: notes.trim() || null, metadata: { status } }); onClose(); }}>{saving ? "Saving…" : "Save assignment"}</Button>{existing && <Button color="inherit" disabled={saving} onClick={async () => { await onReset(); onClose(); }}>Reset</Button>}<Button color="inherit" onClick={onClose}>Cancel</Button></Stack>
        </Box>}
    </Drawer>;
};

const StatCard = ({
    eyebrow,
    value,
    caption,
    toneValue,
}: {
    eyebrow: string;
    value: string;
    caption: string;
    toneValue?: number;
}) => (
    <Card sx={{ minWidth: 0, bgcolor: "rgba(255,255,255,0.02)" }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
            <Typography variant="overline" color="text.secondary" fontWeight={800}>
                {eyebrow}
            </Typography>
            <Typography
                variant="h5"
                fontWeight={780}
                sx={{ mt: 0.45, color: toneValue == null ? "text.primary" : pnlColor(toneValue) }}
            >
                {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.55}>
                {caption}
            </Typography>
        </CardContent>
    </Card>
);

type AllocationSlice = {
    id: string;
    kind: "wallet" | "lp";
    label: string;
    affiliation: string;
    value: number;
    symbol: string;
    logoPath?: string | null;
    assets?: Array<{ symbol: string; logoPath?: string | null }>;
};

const AllocationChart = ({ slices }: { slices: AllocationSlice[] }) => {
    const visible = slices.filter((slice) => slice.value > 0);
    const total = visible.reduce((sum, slice) => sum + slice.value, 0);
    const groups = [
        { kind: "wallet" as const, label: "Wallet assets", color: "#8b7cff", caption: "Liquid balances by wallet" },
        { kind: "lp" as const, label: "Deployed LP", color: "#55e1a6", caption: "Capital grouped by protocol and wallet" },
    ].map((group) => ({
        ...group,
        items: visible.filter((slice) => slice.kind === group.kind).slice(0, 6),
        value: visible.filter((slice) => slice.kind === group.kind).reduce((sum, slice) => sum + slice.value, 0),
    }));
    return (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.025)", minWidth: 0 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 1.75 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline"><Box><Typography variant="subtitle1" fontWeight={780}>Allocation</Typography><Typography variant="caption" color="text.secondary">Ownership and deployment are separated below.</Typography></Box><Typography variant="body2" fontWeight={760}>{compactUsd(total)}</Typography></Stack>
                {!total ? <Typography color="text.secondary" sx={{ py: 2 }}>No priced allocation is available.</Typography> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.25, mt: 1.2 }}>
                    {groups.map((group) => <Box key={group.kind} sx={{ minWidth: 0, p: 1.1, borderRadius: 1.5, border: "1px solid", borderColor: group.kind === "lp" ? "rgba(85,225,166,.2)" : "rgba(139,124,255,.2)", bgcolor: group.kind === "lp" ? "rgba(85,225,166,.035)" : "rgba(139,124,255,.035)" }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} mb={0.7}><Box><Typography variant="overline" fontWeight={800} sx={{ color: group.color, lineHeight: 1.2 }}>{group.label}</Typography><Typography variant="caption" color="text.secondary" display="block">{group.caption}</Typography></Box><Typography variant="body2" fontWeight={760}>{compactUsd(group.value)}</Typography></Stack>
                        {group.items.map((slice) => {
                            const share = total > 0 ? slice.value / total * 100 : 0;
                            return <Stack key={slice.id} direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0, py: 0.38 }}>{slice.kind === "lp" && (slice.assets?.length || 0) > 1 ? <PairMarks assets={slice.assets || []} size={24} /> : <AssetMark symbol={slice.symbol} logoPath={slice.logoPath} size={24} />}<Box minWidth={0} flex={1}><Stack direction="row" justifyContent="space-between" spacing={1}><Box minWidth={0}><Typography variant="body2" fontWeight={700} noWrap>{slice.label}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block">{slice.affiliation}</Typography></Box><Typography variant="caption" color="text.secondary">{share.toFixed(1)}%</Typography></Stack><LinearProgress variant="determinate" value={share} sx={{ mt: 0.35, height: 3, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: group.color } }} /></Box><Typography variant="caption" fontWeight={700} sx={{ width: 58, textAlign: "right" }}>{compactUsd(slice.value)}</Typography></Stack>;
                        })}
                        {!group.items.length && <Typography variant="caption" color="text.secondary">No {group.label.toLowerCase()}.</Typography>}
                    </Box>)}
                </Box>}
            </CardContent>
        </Card>
    );
};

const RobinhoodPerformance = () => {
    const { data, loading, refreshing, savingClassification, error, refresh, assignTransaction, resetTransactionAssignment } = useRobinhoodPerformance();
    const [closedSearch, setClosedSearch] = useState("");
    const [closedFilter, setClosedFilter] = useState<"all" | "profit" | "loss">("all");
    const [closedSort, setClosedSort] = useState<"newest" | "pnl" | "return">("newest");
    const [showZeroArchive, setShowZeroArchive] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<LedgerRow | null>(null);
    const [selectedLiquidity, setSelectedLiquidity] = useState<LiquidityPosition | null>(null);
    const [selectedLpLifecycle, setSelectedLpLifecycle] = useState<LpLedgerRow | null>(null);
    const [selectedReviewEvent, setSelectedReviewEvent] = useState<LpLifecycleEvent | null>(null);
    const [reviewFilter, setReviewFilter] = useState<"all" | "unassigned" | "lp" | "other">("all");

    if (loading) {
        return (
            <Card sx={{ p: { xs: 2.5, sm: 4 }, my: 2.5, minHeight: 280, display: "grid", placeItems: "center", textAlign: "center" }}>
                <Box><CircularProgress size={30} /><Typography variant="h5" fontWeight={800} sx={{ mt: 2 }}>Preparing Robinhood portfolio</Typography><Typography color="text.secondary" sx={{ mt: 0.75 }}>Loading the last verified ledger and live position values.</Typography></Box>
            </Card>
        );
    }

    if (error || !data) {
        return (
            <Alert
                severity="warning"
                action={
                    <IconButton onClick={refresh}>
                        <RefreshRounded />
                    </IconButton>
                }
                sx={{ my: 2.5 }}
            >
                {error}
            </Alert>
        );
    }

    const { funding, tokenPnl, valuation } = data;
    const holdings = data.currentState?.holdings || [];
    const protocolPositions = (data.currentState?.protocolPositions || []) as LiquidityPosition[];
    const liquidityPositions = protocolPositions.filter((position) => position.kind === "LP");
    const assignableV4Positions = liquidityPositions.filter((position) => /uniswap\s*v4/i.test(position.protocol || ""));
    const livePositionGroups = new Map<string, LiquidityPosition[]>();
    for (const position of liquidityPositions) {
        const pairKey = canonicalPairKey(position.assets.map((asset) => asset.symbol));
        const version = /uniswap\s*v4/i.test(position.protocol || "") ? "uniswap-v4" : String(position.protocol || position.id).toLowerCase();
        const key = pairKey ? `${version}:${pairKey}` : `position:${position.id}`;
        livePositionGroups.set(key, [...(livePositionGroups.get(key) || []), position]);
    }
    const displayLiquidityPositions: LiquidityPosition[] = Array.from(livePositionGroups.entries()).map(([key, positions]) => {
        if (positions.length === 1) return positions[0];
        return {
            ...positions[0],
            id: `strategy:${key}`,
            walletTag: `${positions.length} position NFTs`,
            name: `${canonicalPairLabel(positions[0].assets.map((asset) => asset.symbol))} strategy`,
            currentValueUsd: positions.reduce((sum, position) => sum + Number(position.currentValueUsd || 0), 0),
            assets: Array.from(positions.reduce((assets, position) => {
                for (const asset of position.assets) {
                    const assetKey = String(asset.contract || asset.symbol).toLowerCase();
                    const current = assets.get(assetKey) || { ...asset, symbol: asset.symbol === "WETH" ? "ETH" : asset.symbol, amount: 0, usdValue: 0 };
                    current.amount += Number(asset.amount || 0);
                    current.usdValue += Number(asset.usdValue || 0);
                    assets.set(assetKey, current);
                }
                return assets;
            }, new Map<string, LiquidityPosition["assets"][number]>()).values()),
            pricing: { method: "combined-provider", confidence: "high", source: `${positions.length} provider-backed positions in this strategy` },
            underlyingPositions: positions,
        };
    });
    const deployedLpContracts = new Set(liquidityPositions.flatMap((position) =>
        position.assets.map((asset) => String(asset.contract || "").toLowerCase()).filter(Boolean)
    ));
    const assetLogoBySymbol = new Map<string, string | null | undefined>();
    for (const holding of holdings) assetLogoBySymbol.set(String(holding.symbol || "").toUpperCase(), holding.logoPath);
    for (const position of protocolPositions) for (const asset of position.assets) {
        if (asset.logoPath) assetLogoBySymbol.set(String(asset.symbol || "").toUpperCase(), asset.logoPath);
    }
    const trackedWallets = data.wallets?.length ? data.wallets : [data.wallet].filter(Boolean);
    const nonEthHoldings = holdings.filter((holding) => normalize(holding.symbol) !== "eth");
    const ethHolding = holdings.find((holding) => normalize(holding.symbol) === "eth");
    const currentEthUsd = Number(ethHolding?.price || valuation.ethUsd || 0);
    const duplicateSymbols = new Set(
        tokenPnl
            .map((row) => normalize(row.symbol))
            .filter((symbol, index, symbols) => symbols.indexOf(symbol) !== index)
    );

    const rows: LedgerRow[] = tokenPnl.filter((row) => row.classification !== "developer-lp").map((row) => {
        const balance = Number(row.attributableBalance ?? row.walletBalance ?? 0);
        const dustThreshold = Math.max(1e-8, Number(row.quantityBought || 0) * 1e-9);
        const isClosed = Boolean(row.manuallyClosed) || balance <= dustThreshold;
        const displaySymbol = row.classification === "developer-expense"
            ? `${row.symbol} · DEV`
            : row.classification === "developer-lp"
                ? `${row.symbol} · DEV LP`
            : duplicateSymbols.has(normalize(row.symbol))
                ? `${row.symbol} · ${shortContract(row.contract)}`
                : row.symbol;
        return {
            ...row,
            balance,
            currentValueUsd: isClosed ? 0 : row.currentValueUsd,
            displayValueUsd: row.classification === "developer-lp"
                ? row.lpAccounting?.returnedValueUsdAtExitPrices
                : (isClosed ? Number(row.ethReceived || 0) * currentEthUsd : row.currentValueUsd),
            investedUsd: row.classification === "developer-lp"
                ? Number(row.lpAccounting?.depositedValueUsdAtExitPrices || 0)
                : Number(row.ethInvested || 0) * currentEthUsd,
            totalPnlUsd: row.totalPnlUsd,
            returnPercentage: row.returnPercentage,
            isClosed,
            displaySymbol,
        };
    });

    const openRows = rows
        .filter((row) => !row.isClosed && Number(row.currentValueUsd || 0) >= MIN_POSITION_VALUE_USD)
        .sort((left, right) => Number(right.currentValueUsd || 0) - Number(left.currentValueUsd || 0));
    const closedRows = rows
        // A token currently held inside a provider-backed LP is deployed
        // capital, not a closed token trade—even if its wallet balance is zero.
        .filter((row) => row.isClosed && !deployedLpContracts.has(String(row.contract || "").toLowerCase()))
        .sort((left, right) => Number(right.totalPnlUsd || 0) - Number(left.totalPnlUsd || 0));
    const inspectableClosedRows = (() => {
        const search = closedSearch.trim().toLowerCase();
        return closedRows
            .filter((row) => showZeroArchive || Math.abs(Number(row.totalPnlUsd || 0)) >= MIN_POSITION_VALUE_USD)
            .filter((row) => {
                if (closedFilter === "all") return true;
                return positionOutcome(row) === closedFilter;
            })
            .filter((row) => !search || `${row.displaySymbol} ${row.name} ${row.contract}`.toLowerCase().includes(search))
            .sort((left, right) => {
                if (closedSort === "pnl") return Number(right.totalPnlUsd || 0) - Number(left.totalPnlUsd || 0);
                if (closedSort === "return") return Number(right.returnPercentage || 0) - Number(left.returnPercentage || 0);
                const rightTimestamp = right.closedAt || right.timeline?.[right.timeline.length - 1]?.timestamp || "";
                const leftTimestamp = left.closedAt || left.timeline?.[left.timeline.length - 1]?.timestamp || "";
                return String(rightTimestamp).localeCompare(String(leftTimestamp));
            });
    })();
    const topOpenRows = openRows.slice(0, 6);
    const unpricedOpenCount = rows.filter((row) => !row.isClosed && row.currentValueUsd == null).length;
    const portfolioValueUsd = holdings.reduce(
        (total, holding) => total + Number(holding.usdValue || 0),
        0
    );
    const deployedValueUsd = protocolPositions.reduce((total, position) => total + Number(position.currentValueUsd || 0), 0);
    const totalTrackedValueUsd = portfolioValueUsd + deployedValueUsd;
    const allocationSlices: AllocationSlice[] = [
        ...holdings.map((holding) => {
            const walletTags = Array.from(new Set((holding.wallets || []).filter((wallet) => Number(wallet.amount || 0) > 0).map((wallet) => wallet.tag).filter(Boolean)));
            return { id: `wallet:${holding.contract || holding.symbol}`, kind: "wallet" as const, label: holding.symbol || holding.name, affiliation: walletTags.length ? walletTags.join(" · ") : "Tracked wallets", symbol: holding.symbol, logoPath: holding.logoPath, value: Number(holding.usdValue || 0) };
        }),
        ...protocolPositions.map((position) => ({ id: `lp:${position.id}`, kind: "lp" as const, label: position.assets.map((asset) => asset.symbol).join(" / ") || position.name, affiliation: `${position.protocol} · ${position.walletTag}`, symbol: position.assets[0]?.symbol || "LP", logoPath: position.assets[0]?.logoPath, assets: position.assets.slice(0, 2).map((asset) => ({ symbol: asset.symbol, logoPath: asset.logoPath })), value: Number(position.currentValueUsd || 0) })),
    ].filter((slice) => slice.value > 0).sort((left, right) => right.value - left.value);
    const lpPerformanceById = new Map(
        (data.lpPerformance || [])
            .filter((position) => position.positionId)
            .map((position) => [String(position.positionId), position])
    );
    const rawLpLifecycleRows: LpLedgerRow[] = (data.lpLifecycle?.positions || []).map((position) => {
        const live = lpPerformanceById.get(String(position.positionId));
        const symbols = new Set<string>();
        for (const event of position.events || []) {
            if (event.nativeDepositUsd > 0 || event.nativeReturnedUsd > 0) symbols.add("ETH");
            for (const token of [...event.depositedTokens, ...event.returnedTokens]) if (token.symbol) symbols.add(token.symbol);
        }
        const inferredSymbols = Array.from(symbols).slice(0, 3);
        // A v4 lifecycle with one visible ERC-20 symbol still has native ETH as
        // its other side. Older mints sometimes contain no explicit native
        // transfer record, so omitting ETH split one strategy into unrelated
        // CASHCAT/YARD/etc. fragments.
        if (inferredSymbols.length === 1 && inferredSymbols[0] !== "ETH") inferredSymbols.unshift("ETH");
        const pair = live?.pair || position.pair || inferredSymbols.join(" / ") || `Position #${position.positionId}`;
        // The exact provider/NFT match is authoritative for live value. Some
        // cached lifecycle rows carry an empty value until their next replay.
        const currentValueUsd = live?.currentValueUsd ?? position.currentValueUsd ?? (position.status === "closed" ? 0 : null);
        // A provider-backed live value plus the indexed cash flows is enough to
        // show a useful cash-flow estimate. Do not let a chain-wide Blockscout
        // partial-data flag hide every position when this NFT itself has all
        // four operands needed by the calculation.
        const canCalculate = position.valuationStatus === "valued"
            && position.depositsUsd > 0
            && currentValueUsd != null
            && (Boolean(live) || position.status === "closed" || position.manual);
        const pnlUsd = position.pnlUsd ?? (canCalculate
            ? Number(currentValueUsd || 0) + Number(position.returnedUsd || 0) - Number(position.depositsUsd || 0) - Number(position.gasUsd || 0)
            : null);
        return {
            ...position,
            pair,
            currentValueUsd,
            pnlUsd,
            returnPercent: pnlUsd == null || position.depositsUsd <= 0 ? null : pnlUsd / position.depositsUsd * 100,
        };
    }).sort((left, right) => String(right.events?.at(-1)?.timestamp || "").localeCompare(String(left.events?.at(-1)?.timestamp || "")));
    // Explorer history sometimes omits an NFT burn, leaving old zero-liquidity
    // shells marked "open" forever. A live strategy therefore needs a current
    // provider match. Brand-new unmatched mints get a short grace period while
    // the provider/indexer catches up, then move to the inactive archive.
    const freshnessTime = Date.parse(data.dataFreshness?.asOf || "") || Date.now();
    const unmatchedGraceMs = 6 * 60 * 60 * 1000;
    const activeLpLifecycleRows = rawLpLifecycleRows.filter((row) => {
        if (row.status !== "open") return false;
        if (row.currentValueUsd != null && Number(row.currentValueUsd) >= 1) return true;
        const latestActivity = Date.parse(String(row.events?.at(-1)?.timestamp || ""));
        return row.currentValueUsd == null
            && Number.isFinite(latestActivity)
            && freshnessTime - latestActivity >= 0
            && freshnessTime - latestActivity <= unmatchedGraceMs;
    });
    const rawArchivedLpLifecycleRows = rawLpLifecycleRows
        .filter((row) => !activeLpLifecycleRows.includes(row))
        .map((row) => {
            // Old zero-liquidity NFT shells often remain marked open by the
            // indexer. When capital was actually returned, value the shell at
            // zero and expose its cash-flow result. If no return was observed,
            // keep it unavailable: native proceeds may be missing and treating
            // that as a total loss would be misleading.
            if (row.pnlUsd != null || row.depositsUsd <= 0 || row.returnedUsd <= 0) return row;
            const pnlUsd = row.returnedUsd - row.depositsUsd - row.gasUsd;
            return {
                ...row,
                status: "closed" as const,
                currentValueUsd: 0,
                pnlUsd,
                returnPercent: pnlUsd / row.depositsUsd * 100,
            };
        });
    const activePairKeys = new Set(activeLpLifecycleRows.map((row) => canonicalPairKey(row.pair.split(" / "))));
    const archivedLpLifecycleRows = rawArchivedLpLifecycleRows.filter((row) =>
        !activePairKeys.has(canonicalPairKey(row.pair.split(" / ")))
    );
    const adjustedArchivedById = new Map(rawArchivedLpLifecycleRows.map((row) => [row.positionId, row]));
    const activeLifecycleGroups = new Map<string, LpLedgerRow[]>();
    // A live strategy includes every historical NFT for that pair. Repositioned
    // NFT shells contribute their deposits/returns but never current value.
    for (const sourceRow of rawLpLifecycleRows.filter((item) =>
        activePairKeys.has(canonicalPairKey(item.pair.split(" / ")))
    )) {
        const row = adjustedArchivedById.get(sourceRow.positionId) || sourceRow;
        const key = canonicalPairKey(row.pair.split(" / ")) || `position:${row.positionId}`;
        activeLifecycleGroups.set(key, [...(activeLifecycleGroups.get(key) || []), row]);
    }
    const locallyGroupedLpLifecycleRows: LpLedgerRow[] = Array.from(activeLifecycleGroups.entries()).map(([key, rows]) => {
        if (rows.length === 1) return rows[0];
        const knownRows = rows.filter((row) => row.pnlUsd != null);
        const combined: LpLedgerRow = {
            ...rows[0],
            positionId: `strategy:${key.toLowerCase()}`,
            positionIds: rows.map((row) => row.positionId),
            strategy: true,
            pair: canonicalPairLabel(rows.flatMap((row) => row.pair.split(" / "))),
            wallet: "Combined Robinhood wallets",
            walletTag: `${rows.length} position NFTs`,
            openedAt: rows.map((row) => row.openedAt).filter(Boolean).sort()[0] || null,
            closedAt: null,
            status: rows.some((row) => row.status === "open") ? "open" : rows.some((row) => row.status === "unresolved") ? "unresolved" : "closed",
            valuationStatus: knownRows.length === rows.length ? "valued" : "partial",
            depositsUsd: rows.reduce((sum, row) => sum + Number(row.depositsUsd || 0), 0),
            returnedUsd: rows.reduce((sum, row) => sum + Number(row.returnedUsd || 0), 0),
            gasUsd: rows.reduce((sum, row) => sum + Number(row.gasUsd || 0), 0),
            currentValueUsd: rows.reduce((sum, row) =>
                sum + (activeLpLifecycleRows.includes(row) ? Number(row.currentValueUsd || 0) : 0), 0),
            pnlUsd: knownRows.length === rows.length
                ? knownRows.reduce((sum, row) => sum + Number(row.pnlUsd || 0), 0)
                : null,
            returnPercent: null,
            incompletePositionCount: rows.length - knownRows.length,
            events: rows.flatMap((row) => row.events).sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || ""))),
        };
        if (combined.pnlUsd != null) {
            const netInvested = Math.max(0, combined.depositsUsd - combined.returnedUsd);
            combined.returnPercent = netInvested > 0 ? combined.pnlUsd / netInvested * 100 : null;
        }
        return combined;
    });
    // The backend strategy ledger is the accounting authority because it sees
    // every NFT lifecycle across repositions. The previous UI fallback could
    // turn a missing return leg into a fake loss (for example PONS/USDG).
    const auditedLpLifecycleRows: LpLedgerRow[] = (data.lpStrategies || [])
        .filter((strategy) => strategy.status === "open")
        .map((strategy) => ({
            positionId: `strategy:${strategy.strategyKey}`,
            positionIds: strategy.positionIds,
            strategy: true,
            pair: strategy.pair,
            wallet: "Combined Robinhood wallets",
            walletTag: `${strategy.positionIds.length} position NFTs`,
            openedAt: strategy.events.map((event) => event.timestamp).filter(Boolean).sort()[0] || null,
            closedAt: null,
            status: "open",
            matchConfidence: "exact-nft",
            valuationStatus: strategy.accountingStatus === "tracked" ? "valued" : "partial",
            depositsUsd: strategy.depositsUsd,
            returnedUsd: strategy.returnedUsd,
            gasUsd: strategy.gasUsd,
            currentValueUsd: strategy.currentValueUsd,
            pnlUsd: strategy.pnlUsd,
            returnPercent: strategy.returnPercent,
            incompletePositionCount: strategy.incompletePositionIds.length,
            events: strategy.events,
        }));
    const lpLifecycleRows = data.lpStrategies ? auditedLpLifecycleRows : locallyGroupedLpLifecycleRows;
    const unmatchedLpMovements = data.lpLifecycle?.unmatchedMovements || [];
    const classifiedActivities = data.lpLifecycle?.classifiedActivities || [];
    const assignmentByHash = new Map((data.manualClassifications || []).map((assignment) => [assignment.transactionHash.toLowerCase(), assignment]));
    const reviewActivities = [...unmatchedLpMovements, ...classifiedActivities]
        .filter((event) => {
            const classification = assignmentByHash.get(event.hash.toLowerCase())?.classification;
            if (reviewFilter === "unassigned") return !classification || classification === "unknown";
            if (reviewFilter === "lp") return classification === "lp";
            if (reviewFilter === "other") return Boolean(classification && !["unknown", "lp"].includes(classification));
            return true;
        }).sort((left, right) =>
        String(right.timestamp || "").localeCompare(String(left.timestamp || ""))
    );
    const totalPnlAvailable = data.portfolioPnl?.totalPnlUsd != null;
    const totalPnlUsd = totalPnlAvailable ? Number(data.portfolioPnl?.totalPnlUsd) : null;
    const tokenPnlTotalUsd = Number(data.portfolioPnl?.tokenPnlUsd ?? data.summary?.totalPnlUsd ?? 0);
    const lpPnlTotalUsd = data.portfolioPnl?.lpPnlUsd == null ? null : Number(data.portfolioPnl.lpPnlUsd);
    const liveMoneyRows: Array<{ label: string; value: string; helper: string; toneValue?: number }> = [
        { label: "Wallet assets", value: usd(portfolioValueUsd), helper: "Live token balances in tracked wallets." },
        { label: "Deployed LP", value: usd(deployedValueUsd), helper: `${liquidityPositions.length} provider-backed liquidity position${liquidityPositions.length === 1 ? "" : "s"}.` },
        { label: "Live portfolio", value: usd(totalTrackedValueUsd), helper: "Wallet assets + deployed protocol positions." },
        {
            label: "Total tracked P&L",
            value: totalPnlUsd == null ? "Pending LP data" : signedUsd(totalPnlUsd),
            helper: totalPnlUsd == null
                ? `${signedUsd(tokenPnlTotalUsd)} token P&L is tracked; ${data.portfolioPnl?.incompleteLpStrategyCount || 0} LP strateg${data.portfolioPnl?.incompleteLpStrategyCount === 1 ? "y is" : "ies are"} incomplete.`
                : `${signedUsd(tokenPnlTotalUsd)} tokens · ${signedUsd(lpPnlTotalUsd || 0)} LP.`,
            toneValue: totalPnlUsd == null ? undefined : totalPnlUsd,
        },
    ];
    const walletExposure = new Map<string, number>();
    for (const holding of holdings) for (const wallet of holding.wallets || []) {
        walletExposure.set(wallet.tag, (walletExposure.get(wallet.tag) || 0) + Number(wallet.usdValue || 0));
    }
    for (const position of protocolPositions) {
        walletExposure.set(position.walletTag, (walletExposure.get(position.walletTag) || 0) + Number(position.currentValueUsd || 0));
    }
    const walletExposureRows = [...walletExposure.entries()].sort((left, right) => right[1] - left[1]);
    const externalFundingUsd = funding.externalFunding * currentEthUsd;
    const grossFundingUsd = Number(funding.grossExternalFunding || 0) * currentEthUsd;
    const capitalReturnedUsd = Number(funding.externalWithdrawals || 0) * currentEthUsd;
    const walletResultUsd = portfolioValueUsd - externalFundingUsd;
    const fundingLooksBroken =
        data.reconciliation?.authoritative === false ||
        data.reconciliation?.status === "Incomplete" ||
        data.dataQuality?.internalTransactionsAvailable === false ||
        Number(funding.grossExternalFunding || 0) < Number(funding.externalWithdrawals || 0);
    const currentEthBalance = Number(ethHolding?.amount ?? funding.currentEthBalance ?? 0);
    const performanceFreshness = data.dataFreshness;
    const ethReserveUsd = Number(ethHolding?.usdValue || currentEthBalance * currentEthUsd);
    const ethReservePercent = portfolioValueUsd > 0 ? (ethReserveUsd / portfolioValueUsd) * 100 : 0;
    const openValueUsd = openRows.reduce(
        (sum, row) => sum + Number(row.currentValueUsd || 0),
        0
    );
    const capitalReturnedRatio = grossFundingUsd > 0 ? (capitalReturnedUsd / grossFundingUsd) * 100 : 0;
    const deployedRatio = grossFundingUsd > 0 ? (externalFundingUsd / grossFundingUsd) * 100 : 0;
    const summaryRows = fundingLooksBroken
        ? [
        {
            label: "Wallet now",
            value: usd(portfolioValueUsd),
            helper: eth(currentEthBalance),
        },
        {
            label: "ETH reserve",
            value: usd(ethReserveUsd),
            helper: `${eth(currentEthBalance)} · ${ethReservePercent.toFixed(1)}% in ETH.`,
        },
            {
                label: "Open positions",
                value: String(openRows.length),
                helper: `${closedRows.length} closed.`,
            },
            {
                label: "Sync status",
                value: "Refreshing",
                helper: "Funding history incomplete.",
            },
        ]
        : [
        {
            label: "Sent in",
            value: usd(grossFundingUsd),
            helper: eth(Number(funding.grossExternalFunding || 0)),
        },
        {
            label: "Taken back out",
            value: usd(capitalReturnedUsd),
            helper: `${eth(Number(funding.externalWithdrawals || 0))} · ${capitalReturnedRatio.toFixed(0)}% returned.`,
            toneValue: 1,
        },
        {
            label: "Still deployed",
            value: usd(externalFundingUsd),
            helper: eth(Number(funding.externalFunding || 0)),
            toneValue: -1,
        },
        {
            label: "Wallet now",
            value: usd(portfolioValueUsd),
            helper: eth(currentEthBalance),
        },
        {
            label: "Result",
            value: signedUsd(walletResultUsd),
            helper:
                currentEthUsd > 0
                    ? `${Number(walletResultUsd / currentEthUsd) >= 0 ? "+" : "−"}${eth(Math.abs(walletResultUsd / currentEthUsd))}`
                    : "—",
            toneValue: walletResultUsd,
        },
        ];
    const cashFlowRows = [
        {
            label: "1. Gross funded in",
            helper: "All deposits in.",
            value: grossFundingUsd,
            ethValue: Number(funding.grossExternalFunding || 0),
        },
        {
            label: "2. Capital returned",
            helper: "Withdrawn or bridged out.",
            value: -capitalReturnedUsd,
            ethValue: -Number(funding.externalWithdrawals || 0),
        },
        {
            label: "3. Still deployed",
            helper: "Sent in minus returned.",
            value: externalFundingUsd,
            emphasize: true,
            ethValue: Number(funding.externalFunding || 0),
        },
        {
            label: "4. Current wallet value",
            helper: "Live value now.",
            value: portfolioValueUsd,
            emphasize: true,
            ethValue: portfolioValueUsd / currentEthUsd,
        },
        {
            label: "5. Trading result",
            helper: "Value now minus deployed.",
            value: walletResultUsd,
            toneValue: walletResultUsd,
            ethValue: currentEthUsd > 0 ? walletResultUsd / currentEthUsd : 0,
        },
    ];

    return (
        <Box sx={{ my: 2.5 }}>
            {data.dataQuality?.internalTransactionsAvailable === false && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                    Showing the latest available performance while Robinhood Chain&apos;s internal-transaction
                    index catches up.
                </Alert>
            )}

            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ py: { xs: 1.25, sm: 1.5 } }}>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        spacing={1.5}
                    >
                        <Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Chip size="small" label="Robinhood Chain" color="primary" variant="outlined" />
                                <Chip size="small" label={`${trackedWallets.length} wallet${trackedWallets.length === 1 ? "" : "s"} tracked`} color="primary" variant="outlined" />
                                <Chip size="small" label={`${openRows.length} open`} variant="outlined" />
                                <Chip size="small" label={`${closedRows.length} closed`} variant="outlined" />
                            </Stack>
                            <Typography variant="h4" fontWeight={780} mt={1.2}>
                                Robinhood portfolio
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Tooltip title={refreshing ? "Explorer indexing is in progress" : "Refresh performance"}>
                                <span>
                                    <IconButton onClick={refresh} disabled={refreshing}>
                                        {refreshing ? <CircularProgress size={20} /> : <RefreshRounded />}
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Stack>
                    {performanceFreshness && (
                        <Box sx={{ mt: 0.75, maxWidth: 680 }}>
                            <Typography
                                variant="caption"
                                sx={{ display: "block", color: refreshing || performanceFreshness.stale ? "warning.main" : "text.secondary" }}
                            >
                                Last verified snapshot: {shortDateTime(performanceFreshness.asOf)}.
                                {refreshing
                                    ? ` ${performanceFreshness.indexingMessage || "Indexing new Robinhood data in the background."}`
                                    : performanceFreshness.lastError
                                        ? ` ${performanceFreshness.lastError}`
                                        : ""}
                            </Typography>
                            {refreshing && <LinearProgress aria-label="Robinhood history indexing" sx={{ mt: 0.65, height: 4, borderRadius: 4 }} />}
                        </Box>
                    )}

                    <Box
                        sx={{
                            mt: 1.75,
                            p: 1.25,
                            display: "flex",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 1,
                            justifyContent: "space-between",
                            alignItems: { xs: "flex-start", sm: "center" },
                            borderRadius: 2,
                            border: "1px solid rgba(139,124,255,0.18)",
                            bgcolor: "rgba(139,124,255,0.06)",
                        }}
                    >
                        <Box>
                            <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ letterSpacing: 0.55 }}>
                                LIVE SCOPE
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mt={0.25}>
                                {trackedWallets.length} tracked wallet{trackedWallets.length === 1 ? "" : "s"} · {nonEthHoldings.length} priced assets · {liquidityPositions.length} live LP position{liquidityPositions.length === 1 ? "" : "s"}.
                            </Typography>
                        </Box>
                        <Chip size="small" color="success" variant="outlined" label="Internal moves excluded from P&L" />
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25 }} aria-label="Robinhood portfolio sections">
                        {[['Overview', '#rh-overview'], ['LP portfolio', '#rh-liquidity'], ['Token ledger', '#rh-open-ledger'], ['Closed token trades', '#rh-closed-archive']].map(([label, href]) => <Button key={href} size="small" variant="text" href={href} sx={{ color: 'text.secondary', minWidth: 0, px: 1 }}>{label}</Button>)}
                    </Box>

                    <Card id="rh-overview" sx={{ mt: 2.25, bgcolor: "rgba(255,255,255,0.03)", scrollMarginTop: 88 }}>
                        <CardContent sx={{ p: { xs: 2, sm: 2.2 } }}>
                            <Typography variant="overline" color="text.secondary" fontWeight={800}>Money overview</Typography>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 1, mt: 1.5 }}>
                                {liveMoneyRows.map((item) => (
                                    <Box key={item.label} sx={{ p: 1.35, borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)", bgcolor: "rgba(255,255,255,0.02)", minWidth: 0 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>{item.label}</Typography>
                                        <Typography fontWeight={790} sx={{ mt: 0.45, color: item.toneValue == null ? "text.primary" : pnlColor(item.toneValue) }}>{item.value}</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>{item.helper}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                    <Box sx={{ mt: 1.25 }}>
                        <AllocationChart slices={allocationSlices} />
                    </Box>
                    {(liquidityPositions.length > 0 || lpLifecycleRows.length > 0 || unmatchedLpMovements.length > 0 || classifiedActivities.length > 0) && (
                        <Card id="rh-liquidity" sx={{ mt: 1.25, bgcolor: "rgba(70, 205, 157, 0.045)", border: "1px solid rgba(70, 205, 157, 0.14)", scrollMarginTop: 88, overflow: "hidden" }}>
                            <CardContent sx={{ p: { xs: 1.75, sm: 2 } }}>
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} mb={1.25}>
                                    <Stack direction="row" spacing={1} alignItems="center"><Avatar alt="Uniswap" src={logoUrl("uni.png")} sx={{ width: 32, height: 32, bgcolor: "rgba(255,255,255,.08)" }}>U</Avatar><Box><Typography variant="h6" fontWeight={800}>LP portfolio &amp; lifecycle</Typography><Typography variant="caption" color="text.secondary">Live positions, reconstructed cash flows, and transaction review.</Typography></Box></Stack>
                                    <Stack direction="row" spacing={0.75}><Chip size="small" color="success" variant="outlined" label={`${usd(deployedValueUsd)} live`} /><Chip size="small" variant="outlined" label={`${data.lpLifecycle?.movementCount || 0} operations`} /></Stack>
                                </Stack>

                                {!!liquidityPositions.length && <>
                                    <Typography variant="overline" color="text.secondary" fontWeight={800}>Current LP strategies</Typography>
                                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1, mt: 0.75 }}>
                                        {displayLiquidityPositions.map((position) => (
                                            <Box key={position.id} role="button" tabIndex={0} onClick={() => setSelectedLiquidity(position)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedLiquidity(position); }} sx={{ p: 0.9, border: "1px solid", borderColor: "divider", borderRadius: 1.25, cursor: "pointer", bgcolor: "rgba(0,0,0,0.1)", "&:hover": { bgcolor: "action.hover" } }}>
                                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                    <Stack direction="row" spacing={1} minWidth={0} alignItems="center"><PairMarks assets={position.assets} size={24} /><Box minWidth={0}><Typography fontWeight={760} noWrap>{position.assets.map((asset) => asset.symbol).join(" / ") || position.name}</Typography><Typography variant="caption" color="text.secondary">{position.protocol} · {position.walletTag}</Typography>{!!position.underlyingPositions?.length && <Typography variant="caption" color="primary.light" display="block">View {position.underlyingPositions.length} underlying NFT positions</Typography>}</Box></Stack>
                                                    <Box textAlign="right"><Typography fontWeight={800}>{usd(position.currentValueUsd)}</Typography><Typography variant="caption" color="text.secondary">current value</Typography></Box>
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Box>
                                </>}

                                <Divider sx={{ my: 1.75 }} />
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} mb={1}>
                                    <Box><Typography variant="subtitle1" fontWeight={780}>LP strategy ledger</Typography><Typography variant="caption" color="text.secondary">Positions are combined by pair; individual NFT IDs and every reposition remain in the detail timeline.</Typography></Box>
                                    <Chip size="small" color={unmatchedLpMovements.length ? "warning" : "success"} variant="outlined" label={`${unmatchedLpMovements.length} unassigned`} />
                                </Stack>
                                <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                                    <Table size="small" sx={{ minWidth: 720, "& .MuiTableCell-root": { py: 0.7 } }}>
                                        <TableHead><TableRow><TableCell>Strategy</TableCell><TableCell>Status</TableCell><TableCell align="right">Net invested</TableCell><TableCell align="right">Returned</TableCell><TableCell align="right">Current</TableCell><TableCell align="right">LP P&amp;L</TableCell></TableRow></TableHead>
                                        <TableBody>
                                            {lpLifecycleRows.map((row) => <TableRow hover key={row.positionId} onClick={() => setSelectedLpLifecycle(row)} sx={{ cursor: "pointer" }}>
                                                <TableCell><Stack direction="row" spacing={1} alignItems="center"><PairMarks assets={row.pair.split(" / ").map((symbol) => ({ symbol, logoPath: assetLogoBySymbol.get(symbol.toUpperCase()) }))} size={24} /><Box><Typography fontWeight={750}>{row.pair}{row.strategy ? " strategy" : ""}</Typography><Typography variant="caption" color="text.secondary">{row.strategy ? `${row.positionIds?.length || 0} NFTs combined` : `#${row.positionId}`} · {row.events.length} operation{row.events.length === 1 ? "" : "s"}</Typography></Box></Stack></TableCell>
                                                <TableCell><Chip size="small" color={row.status === "open" ? "success" : row.status === "unresolved" ? "warning" : "default"} variant="outlined" label={row.status === "open" ? "Open" : row.status === "closed" ? "Closed" : "Needs state"} /></TableCell>
                                                <TableCell align="right"><Typography fontWeight={700}>{row.depositsUsd > 0 ? usd(Math.max(0, row.depositsUsd - row.returnedUsd)) : "—"}</Typography><Typography variant="caption" color="text.secondary">net invested</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={700}>{usd(row.returnedUsd)}</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={700}>{row.currentValueUsd == null ? "Unmatched" : usd(row.currentValueUsd)}</Typography></TableCell>
                                                <TableCell align="right">{row.pnlUsd == null ? <Tooltip title={data.lpStrategies?.find((strategy) => `strategy:${strategy.strategyKey}` === row.positionId)?.accountingIssue || "Return data is missing. The dashboard does not assume the missing amount was a loss."}><Typography color="text.secondary">Needs review</Typography></Tooltip> : <Box><Typography fontWeight={760} color={pnlColor(row.pnlUsd)}>{signedUsd(row.pnlUsd)}</Typography><Typography variant="caption" color="text.secondary">{row.returnPercent == null ? "" : `${row.returnPercent >= 0 ? "+" : ""}${row.returnPercent.toFixed(1)}%${row.valuationStatus === "valued" ? "" : " · est."}`}</Typography></Box>}</TableCell>
                                            </TableRow>)}
                                            {!lpLifecycleRows.length && <TableRow><TableCell colSpan={6} sx={{ color: "text.secondary", py: 1.5 }}>Assign related operations below to reconstruct a lifecycle.</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                {!!archivedLpLifecycleRows.length && <Accordion disableGutters sx={{ mt: 1, bgcolor: "rgba(255,255,255,0.018)", border: "1px solid", borderColor: "divider", borderRadius: "10px !important", overflow: "hidden", "&:before": { display: "none" } }}>
                                    <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ minHeight: 46, px: 1.5, "& .MuiAccordionSummary-content": { my: 0.8 } }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%" pr={1} spacing={1}>
                                            <Box><Typography fontWeight={760}>Closed &amp; inactive LP positions</Typography><Typography variant="caption" color="text.secondary">Zero-liquidity NFT shells and completed lifecycles are kept out of the live strategy.</Typography></Box>
                                            <Chip size="small" variant="outlined" label={archivedLpLifecycleRows.length} />
                                        </Stack>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 0 }}>
                                        <TableContainer sx={{ maxHeight: 420, borderTop: "1px solid", borderColor: "divider" }}>
                                            <Table stickyHeader size="small" sx={{ minWidth: 680, "& .MuiTableCell-root": { py: 0.6 } }}>
                                                <TableHead><TableRow><TableCell>Position</TableCell><TableCell>Status</TableCell><TableCell align="right">Added</TableCell><TableCell align="right">Returned</TableCell><TableCell align="right">P&amp;L</TableCell></TableRow></TableHead>
                                                <TableBody>{archivedLpLifecycleRows.map((row) => <TableRow hover key={`archive-${row.positionId}`} onClick={() => setSelectedLpLifecycle(row)} sx={{ cursor: "pointer" }}>
                                                    <TableCell><Stack direction="row" spacing={1} alignItems="center"><PairMarks assets={row.pair.split(" / ").map((symbol) => ({ symbol, logoPath: assetLogoBySymbol.get(symbol.toUpperCase()) }))} size={22} /><Box><Typography variant="body2" fontWeight={720}>{row.pair}</Typography><Typography variant="caption" color="text.secondary">#{row.positionId} · {row.events.length} operations</Typography></Box></Stack></TableCell>
                                                    <TableCell><Chip size="small" variant="outlined" label={row.status === "closed" ? "Closed" : "Inactive"} /></TableCell>
                                                    <TableCell align="right">{row.depositsUsd > 0 ? usd(row.depositsUsd) : "—"}</TableCell>
                                                    <TableCell align="right">{usd(row.returnedUsd)}</TableCell>
                                                    <TableCell align="right">{row.pnlUsd == null ? <Tooltip title="No complete return flow was indexed, so no loss is assumed."><Typography variant="body2" color="text.secondary">Pending data</Typography></Tooltip> : <Box><Typography variant="body2" fontWeight={720} color={pnlColor(row.pnlUsd)}>{signedUsd(row.pnlUsd)}</Typography>{row.valuationStatus !== "valued" && <Typography variant="caption" color="text.secondary">estimated</Typography>}</Box>}</TableCell>
                                                </TableRow>)}</TableBody>
                                            </Table>
                                        </TableContainer>
                                    </AccordionDetails>
                                </Accordion>}
                                {!!(unmatchedLpMovements.length || classifiedActivities.length) && <Box sx={{ mt: 1.5 }}>
                                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}><Box><Typography variant="subtitle1" fontWeight={780}>Transaction review</Typography><Typography variant="caption" color="text.secondary">Classify operations and join related LP flows into lifecycles.</Typography></Box><FormControl size="small" sx={{ minWidth: 145 }}><InputLabel>Show</InputLabel><Select label="Show" value={reviewFilter} onChange={(change) => setReviewFilter(change.target.value as typeof reviewFilter)}><MenuItem value="all">All operations</MenuItem><MenuItem value="unassigned">Unassigned</MenuItem><MenuItem value="lp">Assigned LP</MenuItem><MenuItem value="other">Swaps / other</MenuItem></Select></FormControl></Stack>
                                    <TableContainer sx={{ mt: 0.8, maxHeight: 360, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                                        <Table stickyHeader size="small" sx={{ minWidth: 900, "& .MuiTableCell-root": { py: 0.55 } }}>
                                            <TableHead><TableRow><TableCell>Activity</TableCell><TableCell>Classification</TableCell><TableCell>Wallet</TableCell><TableCell align="right">Flow in</TableCell><TableCell align="right">Flow out</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
                                            <TableBody>{reviewActivities.map((event) => { const assignment = assignmentByHash.get(event.hash.toLowerCase()); return <TableRow hover key={event.hash}>
                                                <TableCell><Typography fontWeight={720} sx={{ textTransform: "capitalize" }}>{event.type.replaceAll("-", " ")}</Typography><Typography variant="caption" color="text.secondary">{shortDateTime(event.timestamp || undefined)}</Typography></TableCell>
                                                <TableCell>{assignment && assignment.classification !== "unknown" ? <Chip size="small" color={assignment.classification === "lp" ? "success" : "default"} variant="outlined" label={assignment.classification === "lp" ? assignment.label || "LP" : assignment.classification.replaceAll("-", " ")} /> : <Chip size="small" color="warning" variant="outlined" label="Unassigned" />}</TableCell>
                                                <TableCell><Typography variant="body2">{shortWallet(event.wallet)}</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={680}>{event.nativeDepositUsd + event.tokenDepositUsd > 0 ? usd(event.nativeDepositUsd + event.tokenDepositUsd) : "—"}</Typography><Typography variant="caption" color="text.secondary">{flowLabel(event, "depositedTokens")}</Typography></TableCell>
                                                <TableCell align="right"><Typography fontWeight={680}>{event.returnedUsd > 0 ? usd(event.returnedUsd) : "—"}</Typography><Typography variant="caption" color="text.secondary">{flowLabel(event, "returnedTokens")}</Typography></TableCell>
                                                <TableCell align="right"><Button size="small" onClick={() => setSelectedReviewEvent(event)}>{assignment ? "Edit" : "Classify"}</Button><Button size="small" component="a" href={event.transactionUrl} target="_blank" rel="noreferrer">Tx</Button></TableCell>
                                            </TableRow>; })}{!reviewActivities.length && <TableRow><TableCell colSpan={6} sx={{ py: 2, color: "text.secondary" }}>No operations match this filter.</TableCell></TableRow>}</TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>}
                            </CardContent>
                        </Card>
                    )}
                    </Box>
                <Box sx={{ py: { xs: 2.25, sm: 2.75 } }}>
                    <Divider />
                    <Box sx={{ pt: { xs: 2.25, sm: 2.75 } }}>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.05fr) minmax(320px, 0.95fr)" },
                                alignItems: "start",
                                gap: 1.5,
                            }}
                        >
                            <Stack spacing={1.5} sx={{ minWidth: 0, alignSelf: "start", width: "100%" }}>
                                <Card sx={{ bgcolor: "rgba(255,255,255,0.02)", minWidth: 0, overflow: "hidden", width: "100%" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
                                        <Typography variant="h6" fontWeight={760}>
                                            Current exposure
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" mt={0.45} mb={1.25}>
                                            Largest open positions ranked by current tracked value.
                                        </Typography>
                                        <Stack spacing={1.05}>
                                            {topOpenRows.map((row) => {
                                                const share =
                                                    openValueUsd > 0
                                                        ? (Number(row.currentValueUsd || 0) / openValueUsd) * 100
                                                        : 0;
                                                return (
                                                    <Box key={row.contract} sx={{ minWidth: 0 }}>
                                                        <Stack
                                                            direction="row"
                                                            justifyContent="space-between"
                                                            alignItems="flex-start"
                                                            spacing={1.1}
                                                            mb={0.45}
                                                        >
                                                            <Stack direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }} alignItems="center">
                                                                <AssetMark symbol={row.symbol || row.displaySymbol} logoPath={row.logoPath} size={24} />
                                                                <Box minWidth={0}><Typography fontWeight={740} noWrap>{row.displaySymbol}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.name}</Typography></Box>
                                                            </Stack>
                                                            <Box
                                                                sx={{
                                                                    textAlign: "right",
                                                                    flex: "0 0 auto",
                                                                    minWidth: 0,
                                                                    maxWidth: { xs: "44%", md: "38%" },
                                                                }}
                                                            >
                                                                <Typography fontWeight={740} noWrap>
                                                                    {row.currentValueUsd == null ? "—" : compactUsd(row.currentValueUsd)}
                                                                </Typography>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: "text.secondary", display: "block" }}
                                                                    noWrap
                                                                >
                                                                    {eth(Number(row.attributableBalance && row.currentValueEth != null ? row.currentValueEth : 0))}
                                                                </Typography>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: pnlColor(row.totalPnlUsd ?? 0), display: "block" }}
                                                                    noWrap
                                                                >
                                                                    {row.totalPnlUsd == null ? "—" : signedUsd(row.totalPnlUsd)}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.max(2, Math.min(100, share))}
                                                            sx={{
                                                                height: 7,
                                                                borderRadius: 999,
                                                                bgcolor: "rgba(255,255,255,0.06)",
                                                            }}
                                                        />
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                    </CardContent>
                                </Card>

                                <Card sx={{ bgcolor: "rgba(255,255,255,0.02)", width: "100%" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                                            <Box><Typography variant="h6" fontWeight={760}>Exposure map</Typography><Typography variant="body2" color="text.secondary">Wallet balances and deployed protocol capital are kept separate.</Typography></Box>
                                            <Typography fontWeight={780}>{usd(totalTrackedValueUsd)}</Typography>
                                        </Stack>
                                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 1.5 }}>
                                            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)" }}><Typography variant="caption" color="text.secondary">Wallet assets</Typography><Typography fontWeight={760}>{usd(portfolioValueUsd)}</Typography></Box>
                                            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: "rgba(85,225,166,0.07)" }}><Typography variant="caption" color="text.secondary">Protocol capital</Typography><Typography fontWeight={760}>{usd(deployedValueUsd)}</Typography></Box>
                                        </Box>
                                        <Stack spacing={0.8} sx={{ mt: 1.5 }}>
                                            {walletExposureRows.map(([wallet, value]) => <Box key={wallet}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="body2" noWrap>{wallet}</Typography><Typography variant="body2" fontWeight={700}>{usd(value)} · {totalTrackedValueUsd > 0 ? `${((value / totalTrackedValueUsd) * 100).toFixed(1)}%` : "—"}</Typography></Stack><LinearProgress variant="determinate" value={totalTrackedValueUsd > 0 ? Math.min(100, (value / totalTrackedValueUsd) * 100) : 0} sx={{ mt: 0.45, height: 5, borderRadius: 99 }} /></Box>)}
                                        </Stack>
                                    </CardContent>
                                </Card>

                            </Stack>

                            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                                <Card sx={{ bgcolor: "rgba(255,255,255,0.02)" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
                                        <Typography variant="h6" fontWeight={760}>
                                            Funding map
                                        </Typography>
                                        {fundingLooksBroken ? (
                                            <Alert severity="warning" sx={{ mt: 1.25 }}>
                                                Funding-flow totals are hidden because router and LP return legs do not yet
                                                reconcile to the combined wallet balance. Live wallet and protocol values remain authoritative.
                                            </Alert>
                                        ) : (
                                            <>
                                                <Typography variant="body2" color="text.secondary" mt={0.45} mb={1.5}>
                                                    Sent in, returned, deployed, current value, result.
                                                </Typography>
                                                <Stack spacing={1.1}>
                                                    {cashFlowRows.map((item) => (
                                                        <Box
                                                            key={item.label}
                                                            sx={{
                                                                display: "grid",
                                                                gridTemplateColumns: "minmax(0, 1fr) auto",
                                                                gap: 1.25,
                                                                alignItems: "center",
                                                                py: 1,
                                                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                                                                "&:last-of-type": { borderBottom: "none", pb: 0 },
                                                            }}
                                                        >
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Typography fontWeight={item.emphasize ? 760 : 700}>
                                                                    {item.label}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {item.helper}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                                                <Typography
                                                                    fontWeight={item.emphasize ? 780 : 720}
                                                                    sx={{
                                                                        color:
                                                                            item.toneValue == null
                                                                                ? "text.primary"
                                                                                : pnlColor(item.toneValue),
                                                                    }}
                                                                >
                                                                    {item.value < 0 ? signedUsd(item.value) : usd(item.value)}
                                                                </Typography>
                                                                {"ethValue" in item && (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                        sx={{ display: "block", mt: 0.25 }}
                                                                    >
                                                                        {Number(item.ethValue || 0) >= 0
                                                                            ? eth(item.ethValue)
                                                                            : `${"\u2212"}${eth(Math.abs(Number(item.ethValue || 0)))}`}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                            </Stack>
                        </Box>

                        <Card id="rh-open-ledger" sx={{ overflow: "hidden", mt: 1.5, bgcolor: "rgba(255,255,255,0.02)", scrollMarginTop: 88 }}>
                            <Box
                                sx={{
                                    px: { xs: 1.4, sm: 1.6 }, py: 1.15,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Box>
                                    <Typography variant="subtitle1" fontWeight={780}>
                                            Token trading ledger
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Wallet token positions worth at least $1. LP capital and returns are excluded and tracked in the LP section above.
                                    </Typography>
                                </Box>
                                {walletResultUsd >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                            </Box>
                            <TableContainer sx={{ maxHeight: 480 }}>
                                <Table
                                    stickyHeader
                                    size="small"
                                    sx={{
                                        minWidth: 610,
                                        "& .MuiTableCell-root": {
                                            py: 0.42,
                                        },
                                        "& .MuiTableHead-root .MuiTableCell-root": {
                                            py: 0.7,
                                            fontSize: "0.72rem",
                                            letterSpacing: 0.35,
                                            color: "text.secondary",
                                        },
                                    }}
                                >
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Token</TableCell>
                                            <TableCell align="right">Value / returned</TableCell>
                                            <TableCell align="right">Invested</TableCell>
                                            <TableCell align="right">P&amp;L</TableCell>
                                            <TableCell align="right">Return</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {openRows.map((row) => (
                                            <TableRow
                                                hover
                                                key={row.contract}
                                                onClick={() => setSelectedPosition(row)}
                                                sx={{ "& td": { borderColor: "rgba(255,255,255,0.06)" }, cursor: "pointer" }}
                                            >
                                                <TableCell sx={{ minWidth: 0, width: "38%" }}>
                                                    <Stack direction="row" spacing={0.7} alignItems="center"><AssetMark symbol={row.symbol || row.displaySymbol} logoPath={row.logoPath} size={22} /><Box minWidth={0}><Typography variant="body2" fontWeight={750} noWrap>{row.displaySymbol}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.name}</Typography></Box></Stack>
                                                    {row.classification === "developer-lp" && (
                                                        <Typography variant="caption" color="warning.main" display="block" noWrap>
                                                            Closed · fees + IL combined · exit-price benchmark
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {row.displayValueUsd == null ? (
                                                        "—"
                                                    ) : (
                                                        <>
                                                            <Typography fontWeight={700}>{usd(row.displayValueUsd)}</Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {row.classification === "developer-lp" ? "returned incl. fees" : eth(row.currentValueEth)}
                                                            </Typography>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    <Typography fontWeight={650}>{usd(row.investedUsd)}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {row.classification === "developer-lp" ? "same-price benchmark" : eth(row.ethInvested)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {row.totalPnlUsd == null ? (
                                                        "—"
                                                    ) : (
                                                        <>
                                                            <Typography
                                                                fontWeight={700}
                                                                color={pnlColor(row.totalPnlUsd)}
                                                            >
                                                                {signedUsd(row.totalPnlUsd)}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {Number(row.totalPnlEth || 0) >= 0
                                                                    ? `+${eth(row.totalPnlEth)}`
                                                                    : `${"\u2212"}${eth(Math.abs(Number(row.totalPnlEth || 0)))}`}
                                                            </Typography>
                                                        </>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                    {row.returnPercentage == null ? (
                                                        "—"
                                                    ) : (
                                                        <Typography fontWeight={700} color={pnlColor(row.returnPercentage)}>
                                                            {Number(row.returnPercentage) >= 0 ? "+" : ""}
                                                            {Number(row.returnPercentage).toFixed(1)}%
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {!openRows.length && (
                                            <TableRow><TableCell colSpan={5} sx={{ py: 3, color: "text.secondary" }}>No live positions above the $1 visibility threshold.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Card>
                        {!!closedRows.length && (
                            <Accordion id="rh-closed-archive" disableGutters sx={{ mt: 1.5, bgcolor: "rgba(255,255,255,0.02)", overflow: "hidden", scrollMarginTop: 88, "&:before": { display: "none" } }}>
                                <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: { xs: 1.5, sm: 1.75 }, py: 0.15, minHeight: 52, "& .MuiAccordionSummary-content": { minWidth: 0, my: 0.7 } }}>
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, width: "100%", minWidth: 0 }}>
                                        <Box minWidth={0}>
                                            <Typography variant="subtitle1" fontWeight={780}>Closed token trades</Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap>Completed token trades · click any row for the full lifecycle.</Typography>
                                        </Box>
                                        <Chip size="small" variant="outlined" label={`${closedRows.length} closed`} />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: { xs: 1.25, sm: 1.5 }, pt: 0, pb: 1.5 }}>
                                    <Stack spacing={0.8}>
                                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(180px, 1fr) 125px 145px auto" }, gap: 0.75, alignItems: "center" }}>
                                            <TextField size="small" label="Search closed positions" value={closedSearch} onChange={(event) => setClosedSearch(event.target.value)} />
                                            <FormControl size="small"><InputLabel>Result</InputLabel><Select label="Result" value={closedFilter} onChange={(event) => setClosedFilter(event.target.value as typeof closedFilter)}><MenuItem value="all">All trades</MenuItem><MenuItem value="profit">Profitable</MenuItem><MenuItem value="loss">Losing</MenuItem></Select></FormControl>
                                            <FormControl size="small"><InputLabel>Sort</InputLabel><Select label="Sort" value={closedSort} onChange={(event) => setClosedSort(event.target.value as typeof closedSort)}><MenuItem value="newest">Latest activity</MenuItem><MenuItem value="pnl">P&amp;L</MenuItem><MenuItem value="return">Return</MenuItem></Select></FormControl>
                                            <FormControlLabel control={<Switch size="small" checked={showZeroArchive} onChange={(event) => setShowZeroArchive(event.target.checked)} />} label={<Typography variant="caption">Show dust</Typography>} sx={{ m: 0, whiteSpace: "nowrap" }} />
                                        </Box>
                                        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
                                            <Box sx={{ display: { xs: "none", sm: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 110px 110px 110px 74px", gap: 1, px: 1, py: 0.45, bgcolor: "rgba(0,0,0,.18)", color: "text.secondary" }}><Typography variant="caption">Asset</Typography><Typography variant="caption" textAlign="right">Returned</Typography><Typography variant="caption" textAlign="right">Invested</Typography><Typography variant="caption" textAlign="right">P&amp;L</Typography><Typography variant="caption" textAlign="right">Return</Typography></Box>
                                            {inspectableClosedRows.map((row) => (
                                                <Box key={row.contract} role="button" tabIndex={0} onClick={() => setSelectedPosition(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPosition(row); }} sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr) auto", sm: "minmax(0, 1fr) 110px 110px 110px 74px" }, gap: 1, alignItems: "center", px: 1, py: 0.52, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 }, "&:hover": { bgcolor: "action.hover" } }}>
                                                    <Stack direction="row" spacing={0.7} minWidth={0} alignItems="center"><AssetMark symbol={row.symbol || row.displaySymbol} logoPath={row.logoPath} size={22} /><Box minWidth={0}><Typography variant="body2" fontWeight={740} noWrap>{row.displaySymbol}</Typography><Typography variant="caption" color="text.secondary" noWrap>{row.name} · {shortDateTime(row.closedAt || row.timeline?.[row.timeline.length - 1]?.timestamp)}</Typography></Box></Stack>
                                                    <Typography variant="body2" textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>{row.displayValueUsd == null ? "—" : usd(row.displayValueUsd)}</Typography>
                                                    <Typography variant="body2" textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>{usd(row.investedUsd)}</Typography>
                                                    <Typography variant="body2" fontWeight={700} textAlign="right" sx={{ color: pnlColor(row.totalPnlUsd ?? 0) }}>{row.totalPnlUsd == null ? "Unavailable" : signedUsd(row.totalPnlUsd)}</Typography>
                                                    <Typography variant="caption" color="text.secondary" textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>{row.returnPercentage == null ? "—" : `${Number(row.returnPercentage).toFixed(1)}%`}</Typography>
                                                </Box>
                                            ))}
                                            {!inspectableClosedRows.length && <Typography color="text.secondary" sx={{ p: 2 }}>No closed positions match these filters. Zero-result entries stay hidden unless you enable the archive switch.</Typography>}
                                        </Box>
                                    </Stack>
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </Box>
                </Box>
            </Box>

            {unpricedOpenCount > 0 && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                    {unpricedOpenCount} open position{unpricedOpenCount === 1 ? " has" : "s have"} no usable
                    price. The overall result still uses the actual total shown in Assets.
                </Alert>
            )}
            <PositionDetails row={selectedPosition} onClose={() => setSelectedPosition(null)} />
            <LiquidityDetails position={selectedLiquidity} onClose={() => setSelectedLiquidity(null)} />
            <LpLifecycleDetails row={selectedLpLifecycle} onClose={() => setSelectedLpLifecycle(null)} />
            <TransactionClassifier
                event={selectedReviewEvent}
                livePositions={assignableV4Positions}
                existing={selectedReviewEvent ? assignmentByHash.get(selectedReviewEvent.hash.toLowerCase()) : undefined}
                saving={savingClassification}
                onClose={() => setSelectedReviewEvent(null)}
                onSave={(assignment) => assignTransaction(selectedReviewEvent!.hash, assignment)}
                onReset={() => resetTransactionAssignment(selectedReviewEvent!.hash)}
            />
        </Box>
    );
};

export default RobinhoodPerformance;
