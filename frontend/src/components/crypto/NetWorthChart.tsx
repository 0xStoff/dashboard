import React from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Typography } from "@mui/material";

const processDailyData = (data) => {
  const groupedData = {};

  data.forEach((entry) => {
    const date = new Date(entry.date).toISOString().split("T")[0];
    if (!groupedData[date]) {
      groupedData[date] = { totalNetWorth: 0, count: 0 };
    }
    groupedData[date].totalNetWorth += entry.totalNetWorth;
    groupedData[date].count += 1;
  });

  return Object.entries(groupedData).map(([date, { totalNetWorth, count }]) => ({
    date,
    totalNetWorth: totalNetWorth / count,
  }));
};

export const NetWorthChart = ({ data }) => {
  const processedData = processDailyData(data);

  const startDate = new Date("2025-01-25T23:33:42.697Z").toISOString().split("T")[0];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={processedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => date}
        />
        <YAxis
          tickFormatter={(value) => `$ ${(value / 1000).toLocaleString("de-CH")}k`}
        />
        <Tooltip
          content={({ payload, label }) => {
            if (payload && payload.length) {
              const value = payload[0].value;
              return (
                <Card sx={{ borderRadius: "10px", padding: "15px" }}>
                  <Typography fontWeight="bold" sx={{ lineHeight: 0.9 }}>{`$ ${Number(value)
                    .toLocaleString("de-CH")}`}</Typography>
                  <Typography variant="caption">{label}</Typography>
                </Card>
              );
            }
            return null;
          }}
        />
        <ReferenceLine strokeWidth={2} x={startDate} stroke="#8884d8" />
        <Line
          type="monotone"
          dataKey="totalNetWorth"
          stroke="#8884d8"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};