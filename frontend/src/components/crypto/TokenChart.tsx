import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, Typography } from "@mui/material";
import { toFixedString } from "../../utils/number-utils";

const processTokenData = (token) => {
    return token.history.map((entry) => ({
        date: new Date(entry.date).toISOString().split("T")[0],
        balance: entry.balance,
        usdValue: entry.usdValue,
    }));
};

export const TokenChart = ({ token }) => {
    const processedData = processTokenData(token);

    return (
        <div style={{ marginTop: "20px" }}>
            <h3>{token.name} ({token.symbol})</h3>
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={processedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis
                        yAxisId="left"
                        tickFormatter={(value) => `${toFixedString(value, 2)} ${token.symbol}`}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(value) => `$${toFixedString(value, 2)}`}
                    />
                    <Tooltip
                        content={({ payload, label, active }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <Card sx={{ borderRadius: "10px", padding: "15px" }}>
                                        <Typography fontWeight="bold">{label}</Typography>
                                        <Typography>{`${toFixedString(payload[0].value, 2)} ${token.symbol}`}</Typography>
                                        <Typography>{`$${toFixedString(payload[1].value, 2)}`}</Typography>
                                    </Card>
                                );
                            }
                            return null;
                        }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="balance" stroke="#8884d8" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="usdValue" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};