import React, { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import { formatNumber } from "../../utils/number-utils";
import Chart from "../utils/Chart";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { NetWorthData, Token } from "../../interfaces";

const processProtocolHistory = (netWorthHistory: NetWorthData[], selectedItem: string) => {
    return netWorthHistory
        .map((entry) => {
            const item = entry.protocolHistory?.find((historyItem) => historyItem.name === selectedItem);
            return item
                ? {
                      date: new Date(entry.date).toISOString().split("T")[0],
                      usdValue: item.totalUSD,
                  }
                : null;
        })
        .filter(Boolean);
};

const processTokenHistory = (netWorthHistory: NetWorthData[], selectedItem: string) => {
    return netWorthHistory
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
        .filter(Boolean);
};

const shortenValue = (value: string) => {
    if (value.length <= 18) {
        return value;
    }

    return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

export const TokenChart: React.FC<{
    netWorthHistory: NetWorthData[];
    selectedToken: Token;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
}> = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
    const [copiedField, setCopiedField] = useState<"contract" | null>(null);

    const handleCopy = async (value: string, field: "contract") => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
            window.setTimeout(() => {
                setCopiedField((current) => (current === field ? null : current));
            }, 1500);
        } catch (error) {
            console.error(`Failed to copy ${field}:`, error);
        }
    };

    if (!netWorthHistory?.length) {
        return null;
    }

    let processedData = processTokenHistory(netWorthHistory, selectedToken.symbol);

    if (!processedData.length) {
        processedData = processProtocolHistory(netWorthHistory, selectedToken.name).map((entry) => ({
            ...entry,
            balance: null,
        }));
    }

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", mt: 2.5, gap: 1 }}>
                <ColoredChip label={selectedToken.symbol} fillPercentage={0} variant="outlined" />
                {selectedToken.contract_address ? (
                    <Box
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
                        <Tooltip title={selectedToken.contract_address}>
                            <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                {shortenValue(selectedToken.contract_address)}
                            </Typography>
                        </Tooltip>
                            <Tooltip title={copiedField === "contract" ? "Copied" : "Copy contract"}>
                                <IconButton
                                    size="small"
                                    onClick={() => handleCopy(selectedToken.contract_address as string, "contract")}
                                    aria-label="Copy token contract"
                                >
                                    <ContentCopyRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                ) : null}
                <Button
                    onClick={() => setSelectedToken(null)}
                    variant="text"
                    size="small"
                    sx={{
                        color: "#f44336",
                        minWidth: "auto",
                        padding: "4px",
                        fontWeight: "bold",
                        borderRadius: "50%",
                    }}
                >
                    <CloseIcon fontSize="small" />
                </Button>
            </Box>

            <Chart
                data={processedData}
                lines={[
                    { dataKey: "balance", stroke: "#8884d8", yAxisId: "left" },
                    { dataKey: "usdValue", stroke: "#82ca9d", yAxisId: "right" },
                ]}
                xAxisFormatter={(date) =>
                    new Date(date).toLocaleDateString("de-CH", { month: "short", day: "2-digit" })
                }
                leftYAxisFormatter={(value) => (value !== null ? `${formatNumber(value, "axis")}` : "")}
                rightYAxisFormatter={(value) => `$ ${formatNumber(value, "axis")}`}
            />
        </>
    );
};
