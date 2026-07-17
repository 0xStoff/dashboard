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

const isHistoryPoint = <T,>(item: T | null): item is T => item !== null;

const processProtocolHistory = (netWorthHistory: NetWorthData[], selectedItem: string) =>
    netWorthHistory
        .map((entry) => {
            const item = entry.protocolHistory?.find((historyItem) => historyItem.name === selectedItem);
            return item
                ? { date: new Date(entry.date).toISOString().split("T")[0], usdValue: item.totalUSD }
                : null;
        })
        .filter(isHistoryPoint);

const processTokenHistory = (netWorthHistory: NetWorthData[], selectedItem: string) =>
    netWorthHistory
        .map((entry) => {
            const item = entry.tokenHistory?.find((historyItem) => historyItem.symbol === selectedItem);
            return item
                ? {
                      date: new Date(entry.date).toISOString().split("T")[0],
                      balance: item.amount,
                      usdValue: item.total_usd_value,
                  }
                : null;
        })
        .filter(isHistoryPoint);

export const TokenChart: React.FC<{
    netWorthHistory: NetWorthData[];
    selectedToken: Token;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
}> = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
    if (!netWorthHistory?.length) return null;

    let processedData: ChartHistoryPoint[] = processTokenHistory(netWorthHistory, selectedToken.symbol);
    if (!processedData.length) {
        processedData = processProtocolHistory(netWorthHistory, selectedToken.name).map((entry) => ({
            ...entry,
            balance: null,
        }));
    }

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
            <Chart
                data={processedData}
                lines={[
                    { dataKey: "balance", stroke: "#8884d8", yAxisId: "left" },
                    { dataKey: "usdValue", stroke: "#82ca9d", yAxisId: "right" },
                ]}
                xAxisFormatter={(date: string) =>
                    new Date(date).toLocaleDateString("de-CH", { month: "short", day: "2-digit" })
                }
                leftYAxisFormatter={(value: number) => (value !== null ? `${formatNumber(value, "axis")}` : "")}
                rightYAxisFormatter={(value: number) => `$ ${formatNumber(value, "axis")}`}
            />
        </Card>
    );
};
