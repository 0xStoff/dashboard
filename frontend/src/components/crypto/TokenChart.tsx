import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, Typography, Button } from "@mui/material";
import { toFixedString } from "../../utils/number-utils";

const processTokenHistory = (netWorthHistory, selectedTokenSymbol) => {
    return netWorthHistory
        .map(entry => {
            const token = entry.history.find(token => token.symbol === selectedTokenSymbol);
            return token ? {
                date: entry.date,
                balance: token.amount,
                usdValue: token.total_usd_value,
            } : null;
        })
        .filter(Boolean);
};

export const TokenChart = ({ netWorthHistory, selectedToken, setSelectedToken }) => {
    if (!netWorthHistory || netWorthHistory.length === 0) return null;

    const processedData = processTokenHistory(netWorthHistory, selectedToken);

    return (
        <div style={{ marginTop: "20px" }}>
            <h3>Token Balance & Value Over Time</h3>

            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" tickFormatter={(value) => `${toFixedString(value, 2)}`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${toFixedString(value, 2)}`} />
                    <Tooltip content={({ payload, label, active }) => {
                        if (active && payload && payload.length) {
                            return (
                                <Card sx={{ borderRadius: "10px", padding: "15px" }}>
                                    <Typography fontWeight="bold">{label}</Typography>
                                    <Typography>{`${toFixedString(payload[0].value, 2)} ${selectedToken}`}</Typography>
                                    <Typography>{`$${toFixedString(payload[1].value, 2)}`}</Typography>
                                </Card>
                            );
                        }
                        return null;
                    }} />
                    <Line yAxisId="left" type="monotone" dataKey="balance" stroke="#8884d8" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="usdValue" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};