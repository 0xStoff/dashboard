import React from "react";
import { Refresh, TrendingDown, TrendingUp } from "@mui/icons-material";
import {
    Alert,
    Box,
    Card,
    Chip,
    CircularProgress,
    IconButton,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { useRobinhoodPerformance } from "../../hooks/useRobinhoodPerformance";
import { Token } from "../../interfaces";

const eth = (value: unknown) => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 5 })} ETH`;
const usd = (value: unknown) => Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});
const signedUsd = (value: unknown) => {
    const amount = Number(value || 0);
    return `${amount >= 0 ? "+" : "−"}${usd(Math.abs(amount))}`;
};
const pnlColor = (value: unknown) => Number(value || 0) >= 0 ? "success.main" : "error.main";
const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const shortContract = (contract: unknown) => `${String(contract || "").slice(0, 6)}…`;

const StatCard = ({ label, value, detail, toneValue }: {
    label: string;
    value: string;
    detail: string;
    toneValue?: number;
}) => (
    <Card sx={{ p: { xs: 2.25, sm: 2.75 }, minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={800}>{label}</Typography>
        <Typography variant="h5" fontWeight={760} sx={{ mt: .5, color: toneValue == null ? "text.primary" : pnlColor(toneValue) }}>
            {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={.5}>{detail}</Typography>
    </Card>
);

const RobinhoodPerformance = ({ assets }: { assets: Token[] }) => {
    const { data, loading, refreshing, error, refresh } = useRobinhoodPerformance();

    if (loading) return <Card sx={{ p: 3, my: 2.5 }}><Skeleton width={260} height={42} /><Skeleton height={220} /></Card>;
    if (error || !data) return <Alert severity="warning" action={<IconButton onClick={refresh}><Refresh /></IconButton>} sx={{ my: 2.5 }}>{error}</Alert>;

    const { funding, tokenPnl, valuation } = data;
    const duplicateSymbols = new Set(tokenPnl
        .map((row) => normalize(row.symbol))
        .filter((symbol, index, symbols) => symbols.indexOf(symbol) !== index));
    const rows: Array<Record<string, any> & {
        balance: number;
        currentValueUsd: number | null;
        investedUsd: number;
        totalPnlUsd: number | null;
        returnPercentage: number | null;
        isClosed: boolean;
        displaySymbol: string;
    }> = tokenPnl.map((row) => {
        const exactAsset = assets.find((candidate) =>
            normalize(candidate.symbol) === normalize(row.symbol) && normalize(candidate.name) === normalize(row.name)
        );
        // A symbol is not a token identity. Only use the symbol fallback when it
        // cannot accidentally price a different contract with the same ticker.
        const asset = exactAsset || (!duplicateSymbols.has(normalize(row.symbol))
            ? assets.find((candidate) => normalize(candidate.symbol) === normalize(row.symbol))
            : undefined);
        const balance = Number(row.walletBalance || 0);
        // Swaps commonly leave a few raw units behind. Treat negligible dust as
        // closed relative to the quantity that was originally bought.
        const dustThreshold = Math.max(1e-8, Number(row.quantityBought || 0) * 1e-9);
        const isClosed = Boolean(row.manuallyClosed) || balance <= dustThreshold;
        const assetPrice = Number(asset?.price || 0);
        const currentValueUsd = isClosed
            ? 0
            : assetPrice > 0
                ? Number(row.attributableBalance || 0) * assetPrice
                : row.currentValueUsd;
        const totalPnlUsd = currentValueUsd == null
            ? null
            : Number(row.realizedPnlUsd || 0) + currentValueUsd - Number(row.remainingCostBasis || 0) * valuation.ethUsd;
        const investedUsd = Number(row.ethInvested || 0) * valuation.ethUsd;
        const returnPercentage = totalPnlUsd == null || !investedUsd ? null : totalPnlUsd / investedUsd * 100;
        const displaySymbol = duplicateSymbols.has(normalize(row.symbol))
            ? `${row.symbol} · ${shortContract(row.contract)}`
            : row.symbol;
        return { ...row, balance, currentValueUsd, investedUsd, totalPnlUsd, returnPercentage, isClosed, displaySymbol };
    });

    const openRows = rows
        .filter((row) => !row.isClosed)
        .sort((left, right) => Number(right.currentValueUsd || 0) - Number(left.currentValueUsd || 0));
    const closedRows = rows
        .filter((row) => row.isClosed)
        .sort((left, right) => Number(right.totalPnlUsd || 0) - Number(left.totalPnlUsd || 0));
    const unpricedOpenCount = rows.filter((row) => !row.isClosed && row.currentValueUsd == null).length;
    const portfolioValueUsd = assets.reduce((total, asset) => total + Number(asset.total_usd_value || 0), 0);
    const externalFundingUsd = funding.externalFunding * valuation.ethUsd;
    const walletResultUsd = portfolioValueUsd - externalFundingUsd;
    const ethAsset = assets.find((asset) => normalize(asset.symbol) === "eth");
    const ethReserveUsd = Number(ethAsset?.total_usd_value || funding.currentEthBalance * valuation.ethUsd);
    const ethReservePercent = portfolioValueUsd > 0 ? ethReserveUsd / portfolioValueUsd * 100 : 0;

    return <Box sx={{ my: 2.5 }}>
        <Card sx={{ p: { xs: 2.25, sm: 3 }, mb: 1.5, background: "linear-gradient(135deg, rgba(78,142,255,.08), rgba(139,124,255,.04))" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                <Box>
                    <Typography variant="overline" color="primary.light" fontWeight={800}>ROBINHOOD CHAIN</Typography>
                    <Typography variant="h4" fontWeight={760}>Portfolio overview</Typography>
                    <Typography color="text.secondary" mt={.5}>{openRows.length} open positions · {closedRows.length} closed trades</Typography>
                </Box>
                <Tooltip title="Refresh performance"><span><IconButton onClick={refresh} disabled={refreshing}>{refreshing ? <CircularProgress size={20} /> : <Refresh />}</IconButton></span></Tooltip>
            </Box>
        </Card>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
            <StatCard label="Wallet value" value={usd(portfolioValueUsd)} detail={`${eth(funding.currentEthBalance)} liquid`} />
            <StatCard
                label="Net funding"
                value={usd(externalFundingUsd)}
                detail={eth(funding.externalFunding)}
            />
            <StatCard label="Overall result" value={signedUsd(walletResultUsd)} detail="Wallet value minus external funding" toneValue={walletResultUsd} />
            <StatCard label="ETH reserve" value={usd(ethReserveUsd)} detail={`${ethReservePercent.toFixed(1)}% of wallet`} />
        </Box>

        <Card sx={{ overflow: "hidden", mt: 1.5 }}>
                <Box sx={{ p: { xs: 2.25, sm: 2.75 }, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box><Typography variant="h6" fontWeight={750}>Full win / loss overview</Typography><Typography variant="body2" color="text.secondary">Open positions first; closed positions appear compactly below.</Typography></Box>
                    {walletResultUsd >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                </Box>
                <TableContainer>
                    <Table stickyHeader sx={{ minWidth: 610 }}>
                        <TableHead><TableRow><TableCell>Token</TableCell><TableCell align="right">Value</TableCell><TableCell align="right">Invested</TableCell><TableCell align="right">P&amp;L</TableCell><TableCell align="right">Return</TableCell></TableRow></TableHead>
                        <TableBody>{openRows.map((row) => <TableRow hover key={row.contract}>
                            <TableCell><Typography fontWeight={750}>{row.displaySymbol}</Typography><Typography variant="caption" color="text.secondary">{row.name}</Typography></TableCell>
                            <TableCell align="right">{row.currentValueUsd == null ? "—" : usd(row.currentValueUsd)}</TableCell>
                            <TableCell align="right">{usd(row.investedUsd)}</TableCell>
                            <TableCell align="right">{row.totalPnlUsd == null ? "—" : <Typography fontWeight={750} color={pnlColor(row.totalPnlUsd)}>{signedUsd(row.totalPnlUsd)}</Typography>}</TableCell>
                            <TableCell align="right">{row.returnPercentage == null ? "—" : <Typography color={pnlColor(row.returnPercentage)}>{Number(row.returnPercentage) >= 0 ? "+" : ""}{Number(row.returnPercentage).toFixed(1)}%</Typography>}</TableCell>
                        </TableRow>)}</TableBody>
                    </Table>
                </TableContainer>
                {!!closedRows.length && <Box sx={{ p: { xs: 2, sm: 2.5 }, borderTop: "1px solid", borderColor: "divider" }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={800}>CLOSED POSITIONS</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                        {closedRows.map((row) => <Chip
                            key={row.contract}
                            size="small"
                            variant="outlined"
                            label={`${row.displaySymbol} ${row.totalPnlUsd == null ? "—" : signedUsd(row.totalPnlUsd)}`}
                            title={`${row.name} · sold for ${eth(row.ethReceived)}`}
                            sx={{ color: row.totalPnlUsd == null ? "text.secondary" : pnlColor(row.totalPnlUsd) }}
                        />)}
                    </Box>
                </Box>}
        </Card>

        {unpricedOpenCount > 0 && <Alert severity="info" sx={{ mt: 1.5 }}>{unpricedOpenCount} open position{unpricedOpenCount === 1 ? " has" : "s have"} no usable price. The overall result still uses the actual total shown in Assets.</Alert>}
    </Box>;
};

export default RobinhoodPerformance;
