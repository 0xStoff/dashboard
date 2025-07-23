import React from "react";
import CloseIcon from '@mui/icons-material/Close';
import {formatNumber, toFixedString} from "../../utils/number-utils";
import Chart from "../utils/Chart";
import {Avatar, Button, Typography} from "@mui/material";
import {ColoredChip} from "../utils/ChipWithTooltip";


const processProtocolHistory = (netWorthHistory, selectedItem) => {
    return netWorthHistory
        .map(entry => {
            const item = entry.protocolHistory?.find(item => item.name === selectedItem);
            return item ? {
                date: new Date(entry.date).toISOString().split("T")[0],
                usdValue: item.totalUSD,
            } : null;
        })
        .filter(Boolean);
};


const processTokenHistory = (netWorthHistory, selectedItem) => {
    return netWorthHistory
        .map(entry => {
            const item = entry.tokenHistory?.find(item => item.symbol === selectedItem);
            return item ? {
                date: new Date(entry.date).toISOString().split("T")[0],
                balance: item.amount,
                usdValue: item.total_usd_value,
            } : null;
        })
        .filter(Boolean);
};

export const TokenChart = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
    if (!netWorthHistory || netWorthHistory.length === 0) return null;

    let processedData = processTokenHistory(netWorthHistory, selectedToken);

    if (!processedData || processedData.length === 0) {
        processedData = processProtocolHistory(netWorthHistory, selectedToken)
            .map(entry => ({ ...entry, balance: null }));
    }

    return (<>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 20, gap: 8 }}>
                <ColoredChip
                    label={selectedToken}
                    fillPercentage={0}
                    variant="outlined"
                />
                <Button
                    onClick={() => setSelectedToken(null)}
                    variant="text"
                    size="small"
                    sx={{
                        color: '#f44336',
                        minWidth: 'auto',
                        padding: '4px',
                        fontWeight: 'bold',
                        borderRadius: '50%',
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
        /></>
    );
};