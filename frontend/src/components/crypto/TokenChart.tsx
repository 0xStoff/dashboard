import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import { Button } from "@mui/material";
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

export const TokenChart: React.FC<{
    netWorthHistory: NetWorthData[];
    selectedToken: Token;
    setSelectedToken: React.Dispatch<React.SetStateAction<Token | null>>;
}> = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
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
            <div style={{ display: "flex", alignItems: "center", marginTop: 20, gap: 8 }}>
                <ColoredChip label={selectedToken.symbol} fillPercentage={0} variant="outlined" />
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
            </div>

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
