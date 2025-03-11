import React from "react";
import {formatNumber, toFixedString} from "../../utils/number-utils";
import Chart from "../utils/Chart";

const processTokenHistory = (netWorthHistory, selectedTokenSymbol) => {
    return netWorthHistory
        .map(entry => {
            const token = entry.history.find(token => token.symbol === selectedTokenSymbol);
            return token ? {
                date: new Date(entry.date).toISOString().split("T")[0],
                balance: token.amount,
                usdValue: token.total_usd_value,
            } : null;
        })
        .filter(Boolean);
};

export const TokenChart = ({netWorthHistory, selectedToken}) => {
    if (!netWorthHistory || netWorthHistory.length === 0) return null;

    const processedData = processTokenHistory(netWorthHistory, selectedToken);

    return (<Chart
            data={processedData}
            lines={[{dataKey: "balance", stroke: "#8884d8", yAxisId: "left"}, {
                dataKey: "usdValue",
                stroke: "#82ca9d",
                yAxisId: "right"
            },]}
            xAxisFormatter={(date) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value) => `${formatNumber(value, "axis")}`}
            rightYAxisFormatter={(value) => `$ ${formatNumber(value, "axis")}`}
        />);
};