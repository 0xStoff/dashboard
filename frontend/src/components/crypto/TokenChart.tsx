import React, { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { Box, Card, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import { formatNumber } from "../../utils/number-utils";
import { Token } from "../../interfaces";
import Chart from "../utils/Chart";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { useFetchAssetHistory } from "../../hooks/useFetchAssetHistory";

interface ChartHistoryPoint {
    date: string;
    balance: number | null;
    usdValue: number;
}

const PROTOCOL_CHAIN_ID = "protocol";

const getHistoryDate = (value: string): string | null => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split("T")[0];
};

const processHistory = (assetHistory: ChartHistoryPoint[]): ChartHistoryPoint[] => {
    const points = assetHistory.reduce<ChartHistoryPoint[]>((historyPoints, entry) => {
        const date = getHistoryDate(entry.date);
        if (!date) return historyPoints;
        historyPoints.push({
            date,
            balance: entry.balance == null ? null : Number(entry.balance),
            usdValue: Number(entry.usdValue),
        });
        return historyPoints;
    }, []);

    return Array.from(new Map(points.map((point) => [point.date, point])).values());
};

const shortenValue = (value: string) => {
    if (value.length <= 18) {
        return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

export const TokenChart: React.FC<{
    selectedToken: Token;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
    conversionRate: number;
    currencyLabel: string;
    embedded?: boolean;
}> = ({ selectedToken, setSelectedToken, conversionRate, currencyLabel, embedded = false }) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const { history, loading, error } = useFetchAssetHistory(selectedToken);
    const processedData = processHistory(history);
    const chartData = processedData.map((point) => ({
        ...point,
        convertedValue: point.usdValue * conversionRate,
    }));
    const latestPoint = processedData[processedData.length - 1];
    const contractAddresses = Array.from(
        new Set(
            [
                ...(selectedToken.contract_address ? [selectedToken.contract_address] : []),
                ...(selectedToken.contract_addresses || []),
            ].filter(Boolean)
        )
    );

    const handleCopy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(value);
            window.setTimeout(() => {
                setCopiedField((current) => (current === value ? null : current));
            }, 1500);
        } catch (copyError) {
            console.error("Failed to copy contract:", copyError);
        }
    };

    return (
        <Card
            sx={{
                borderRadius: embedded ? 0 : 4,
                border: embedded ? 0 : undefined,
                boxShadow: embedded ? "none" : undefined,
                p: { xs: 2, sm: 2.75 },
                mt: embedded ? 0 : 2,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pr: 1 }}>
                    <Typography id="asset-history-title" variant="h5">Asset history</Typography>
                    <ColoredChip label={selectedToken.symbol} fillPercentage={0} variant="outlined" />
                    {contractAddresses.map((address) => (
                        <Box
                            key={address}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1,
                                py: 0.5,
                                borderRadius: 999,
                                bgcolor: "rgba(255, 255, 255, 0.05)",
                            }}
                        >
                            <Tooltip title={address}>
                                <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                    {shortenValue(address)}
                                </Typography>
                            </Tooltip>
                            <Tooltip title={copiedField === address ? "Copied" : "Copy contract"}>
                                <IconButton
                                    aria-label="Copy contract"
                                    size="small"
                                    onClick={() => handleCopy(address)}
                                >
                                    <ContentCopyRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
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
            {loading ? (
                <Box sx={{ minHeight: 220, display: "grid", placeItems: "center" }}>
                    <CircularProgress size={28} />
                </Box>
            ) : processedData.length ? (
                <>
                    <Box sx={{ mb: 1.5 }}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">CURRENT VALUE</Typography>
                            <Typography variant="h6">{currencyLabel} {formatNumber(latestPoint.usdValue * conversionRate, "axis")}</Typography>
                        </Box>
                    </Box>
                    <Chart
                        data={chartData}
                        lines={[
                            ...(selectedToken.chain_id === PROTOCOL_CHAIN_ID
                                ? []
                                : [{ dataKey: "balance" as const, stroke: "#8884d8", yAxisId: "left" as const }]),
                            { dataKey: "convertedValue", stroke: "#82ca9d", yAxisId: "right" },
                        ]}
                        xAxisFormatter={(date: string) =>
                            new Date(date).toLocaleDateString("de-CH", { month: "short", day: "2-digit" })
                        }
                        leftYAxisFormatter={(value: number) => String(formatNumber(value, "axis"))}
                        rightYAxisFormatter={(value: number) => `${currencyLabel} ${formatNumber(value, "axis")}`}
                        compact
                        currencyLabel={currencyLabel}
                    />
                </>
            ) : (
                <Box sx={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", px: 2 }}>
                    <Box>
                        <Typography fontWeight={700}>No history recorded for this asset yet</Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                            {error
                                ? "History is temporarily unavailable."
                                : "A point will appear after the next wallet refresh."}
                        </Typography>
                    </Box>
                </Box>
            )}
        </Card>
    );
};
