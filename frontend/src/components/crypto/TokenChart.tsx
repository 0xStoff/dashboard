import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, Typography } from "@mui/material";
import { formatNumber, toFixedString } from "../../utils/number-utils";

const processTokenHistory = (netWorthHistory, selectedTokenSymbol) => {
    return netWorthHistory
        .map(entry => {
            const token = entry.history.find(token => token.symbol === selectedTokenSymbol);
            return token ? {
                date: new Date(entry.date).toISOString().split("T")[0], // Ensure consistent date format
                balance: token.amount,
                usdValue: token.total_usd_value,
            } : null;
        })
        .filter(Boolean);
};

export const TokenChart = ({ netWorthHistory, selectedToken }) => {
    if (!netWorthHistory || netWorthHistory.length === 0) return null;

    const processedData = processTokenHistory(netWorthHistory, selectedToken);

    return (
        <ResponsiveContainer width="100%" height={400} style={{ margin: 30 }}>
            <LineChart data={processedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="date"
                    tickFormatter={(date) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })}
                />
                <YAxis
                    yAxisId="left"
                    tickFormatter={(value) => `${toFixedString(value, 2)}`}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
                />
                <Tooltip
                    content={({ payload, label, active }) => {
                        if (active && payload && payload.length) {
                            const index = processedData.findIndex((d) => d.date === label);
                            const currentValue = payload.find((p) => p.dataKey === "usdValue")?.value || 0;
                            const balance = payload.find((p) => p.dataKey === "balance")?.value || 0;
                            const previousValue = index > 0 ? processedData[index - 1].usdValue : null;
                            const percentChange = previousValue !== null
                                ? ((currentValue - previousValue) / previousValue) * 100
                                : null;

                            return (
                                <Card sx={{ borderRadius: "10px", padding: "15px" }}>
                                    {percentChange !== null && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: percentChange >= 0 ? "green" : "red",
                                                textAlign: "right",
                                                display: "block",
                                            }}
                                        >
                                            {`${percentChange >= 0 ? "+" : ""}${toFixedString(percentChange, 2)}%`}
                                        </Typography>
                                    )}
                                    <Typography fontWeight="bold">{`$ ${toFixedString(currentValue, 0)}`}</Typography>
                                    <Typography>{`Balance: ${formatNumber(balance, 'amount')}`}</Typography>
                                    <Typography variant="caption">{label}</Typography>
                                </Card>
                            );
                        }
                        return null;
                    }}
                />
                <Line yAxisId="left" type="monotone" dataKey="balance" stroke="#8884d8" strokeWidth={2} dot={false} activeDot={{r:6}} />
                <Line yAxisId="right" type="monotone" dataKey="usdValue" stroke="#82ca9d" strokeWidth={2} dot={false} activeDot={{r:6}} />
            </LineChart>
        </ResponsiveContainer>
    );
};