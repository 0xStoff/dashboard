import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Card, IconButton, Typography } from "@mui/material";
import { formatNumber } from "../../utils/number-utils";
import { NetWorthData, Token } from "../../interfaces";
import Chart from "../utils/Chart";
import { ColoredChip } from "../utils/ChipWithTooltip";

interface ChartHistoryPoint {
    date: string;
    balance: number | null;
    usdValue: number;
}

const PROTOCOL_CHAIN_ID = "protocol";

const toFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const getHistoryDate = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
};

const processHistory = (netWorthHistory: NetWorthData[], selectedToken: Token): ChartHistoryPoint[] => {
    const points = netWorthHistory.reduce<ChartHistoryPoint[]>((historyPoints, entry) => {
        const date = getHistoryDate(entry.date);
        if (!date) return historyPoints;

        if (selectedToken.chain_id === PROTOCOL_CHAIN_ID) {
            const protocol = entry.protocolHistory?.find(({ name }) => name === selectedToken.name);
            const usdValue = toFiniteNumber(protocol?.totalUSD);
            if (usdValue !== null) historyPoints.push({ date, balance: null, usdValue });
            return historyPoints;
        }

        const tokensWithSymbol = entry.tokenHistory?.filter(({ symbol }) => symbol === selectedToken.symbol) ?? [];
        if (selectedToken.chain_id === "all") {
            const balance = tokensWithSymbol.reduce((sum, token) => sum + (toFiniteNumber(token.amount) || 0), 0);
            const usdValue = tokensWithSymbol.reduce(
                (sum, token) => sum + (toFiniteNumber(token.total_usd_value) || 0),
                0
            );
            if (tokensWithSymbol.length) historyPoints.push({ date, balance, usdValue });
            return historyPoints;
        }
        const token =
            tokensWithSymbol.find(({ chain_id }) => chain_id === selectedToken.chain_id) ??
            // Old snapshots did not always include a chain id. Only fall back when
            // the symbol is unambiguous, otherwise a different chain would be charted.
            (tokensWithSymbol.length === 1 ? tokensWithSymbol[0] : undefined);
        const balance = toFiniteNumber(token?.amount);
        const usdValue = toFiniteNumber(token?.total_usd_value);

        if (balance !== null && usdValue !== null) {
            historyPoints.push({ date, balance, usdValue });
        }
        return historyPoints;
    }, []);

    // Several refreshes can be stored on the same day. Keep the latest point so
    // the x-axis and tooltip have a single, deterministic value per date.
    return Array.from(new Map(points.map((point) => [point.date, point])).values());
};

export const TokenChart: React.FC<{
    netWorthHistory: NetWorthData[];
    selectedToken: Token;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
}> = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
    if (!netWorthHistory?.length) return null;

    const processedData = processHistory(netWorthHistory, selectedToken);
    const latestPoint = processedData[processedData.length - 1];

    return (
        <Card sx={{ borderRadius: 4, p: { xs: 2, sm: 3 }, mt: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h5">Asset history</Typography>
                    <ColoredChip label={selectedToken.symbol} fillPercentage={0} variant="outlined" />
                </Box>
                <IconButton
                    aria-label="Close asset history"
                    onClick={() => setSelectedToken(null)}
                    size="small"
                    sx={{ color: "text.secondary" }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
            {processedData.length ? (
                <>
                    <Box sx={{ mb: 1.5 }}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">CURRENT VALUE</Typography>
                            <Typography variant="h6">${formatNumber(latestPoint.usdValue, "axis")}</Typography>
                        </Box>
                    </Box>
                    <Chart
                        data={processedData}
                        lines={[
                            ...(selectedToken.chain_id === PROTOCOL_CHAIN_ID
                                ? []
                                : [{ dataKey: "balance" as const, stroke: "#8884d8", yAxisId: "left" as const }]),
                            { dataKey: "usdValue", stroke: "#82ca9d", yAxisId: "right" },
                        ]}
                        xAxisFormatter={(date: string) =>
                            new Date(date).toLocaleDateString("de-CH", { month: "short", day: "2-digit" })
                        }
                        leftYAxisFormatter={(value: number) => String(formatNumber(value, "axis"))}
                        rightYAxisFormatter={(value: number) => `$ ${formatNumber(value, "axis")}`}
                        showBrush={processedData.length > 14}
                    />
                </>
            ) : (
                <Box sx={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", px: 2 }}>
                    <Box>
                        <Typography fontWeight={700}>No history recorded for this asset yet</Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            A point will appear after the next saved dashboard snapshot.
                        </Typography>
                    </Box>
                </Box>
            )}
        </Card>
    );
};
