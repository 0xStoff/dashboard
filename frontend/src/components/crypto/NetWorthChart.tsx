import React from "react";
import {NetWorthData} from "../../interfaces";
import Chart from "../utils/Chart";
import {toFixedString} from "../../utils/number-utils";
import {Box, Card, IconButton, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const processDailyData = (data) => {
    const groupedData = {};

    data.forEach((entry) => {
        const date = new Date(entry.date).toISOString().split("T")[0];
        if (!groupedData[date]) {
            groupedData[date] = {totalNetWorth: 0, count: 0};
        }
        groupedData[date].totalNetWorth += entry.totalNetWorth;
        groupedData[date].count += 1;
    });

    return Object.entries(groupedData).map(([date, values]: [string, { totalNetWorth: number, count: number }]) => ({
        date, totalNetWorth: values.totalNetWorth / values.count,
    }));
};


export const NetWorthChart = ({data, setShowChart}) => {
    const processedData: { date: string; totalNetWorth: number }[] = processDailyData(data);
    const startDate = new Date("2025-01-25T23:33:42.697Z").toISOString().split("T")[0];

    return (<Card sx={{borderRadius: 4, p: {xs: 2, sm: 3}, mt: 2.5}}>
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2}}>
          <Box>
            <Typography variant="h5">Net worth history</Typography>
            <Typography variant="body2" color="text.secondary">Portfolio value over time</Typography>
          </Box>
        <IconButton
            aria-label="Close net worth history"
            onClick={() => setShowChart(false)}
            size="small"
            sx={{color: 'text.secondary'}}
        >
            <CloseIcon fontSize="small" />
        </IconButton>
        </Box>
    <Chart
            data={processedData}
            lines={[{dataKey: "totalNetWorth", stroke: "#8884d8", yAxisId: "right"}]}
            xAxisFormatter={(date) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
            rightYAxisFormatter={(value) => `$ ${toFixedString(value, 0)}`}
            referenceLineX={startDate}
        /></Card>);
};
