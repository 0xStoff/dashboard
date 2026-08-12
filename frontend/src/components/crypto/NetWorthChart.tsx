import React, {useMemo, useState} from "react";
import {NetWorthData} from "../../interfaces";
import Chart from "../utils/Chart";
import {toFixedString} from "../../utils/number-utils";
import {Box, Card, IconButton, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface NetWorthChartProps {
    data: NetWorthData[];
    currentNetWorth: number;
    setShowChart: React.Dispatch<React.SetStateAction<boolean>>;
}

const processDailyData = (data: NetWorthData[], currentNetWorth: number) => {
    const latestByDay = new Map<string, {date: string; totalNetWorth: number}>();

    [...data]
        .filter((entry) => Number.isFinite(entry.totalNetWorth) && entry.totalNetWorth > 0)
        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
        .forEach((entry) => {
            const date = new Date(entry.date).toISOString().split("T")[0];
            latestByDay.set(date, entry);
        });

    if (Number.isFinite(currentNetWorth) && currentNetWorth > 0) {
        const now = new Date();
        latestByDay.set(now.toISOString().split("T")[0], {
            date: now.toISOString(),
            totalNetWorth: currentNetWorth,
        });
    }

    return Array.from(latestByDay.entries())
        .map(([date, entry]) => ({date, totalNetWorth: entry.totalNetWorth}))
        .sort((left, right) => left.date.localeCompare(right.date));
};

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
};

export const NetWorthChart = ({currentNetWorth, data, setShowChart}: NetWorthChartProps) => {
    const [range, setRange] = useState<RangeKey>("ALL");
    const processedData = useMemo(
        () => processDailyData(data, currentNetWorth),
        [currentNetWorth, data]
    );
    const visibleData = useMemo(() => {
        const months = RANGE_MONTHS[range];
        if (!months || !processedData.length) return processedData;

        const cutoff = new Date(processedData[processedData.length - 1].date);
        cutoff.setMonth(cutoff.getMonth() - months);
        return processedData.filter((entry) => new Date(entry.date) >= cutoff);
    }, [processedData, range]);

    const firstValue = visibleData[0]?.totalNetWorth || 0;
    const latestValue = visibleData[visibleData.length - 1]?.totalNetWorth || 0;
    const valueChange = latestValue - firstValue;
    const percentageChange = firstValue ? (valueChange / firstValue) * 100 : 0;
    return (<Card sx={{borderRadius: 4, p: {xs: 2, sm: 3}, mt: 2.5}}>
        <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2}}>
          <Box>
            <Typography variant="h5">Net worth history</Typography>
            <Box sx={{display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap", mt: 0.5}}>
                <Typography variant="h4">$ {toFixedString(latestValue, 0)}</Typography>
                <Typography
                    variant="body2"
                    sx={{color: valueChange >= 0 ? "success.main" : "error.main", fontWeight: 700}}
                >
                    {valueChange >= 0 ? "+" : "-"}{toFixedString(Math.abs(valueChange), 0)}
                    {" · "}
                    {percentageChange >= 0 ? "+" : "-"}{toFixedString(Math.abs(percentageChange), 1)}%
                </Typography>
            </Box>
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

        <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            onChange={(_event, nextRange: RangeKey | null) => nextRange && setRange(nextRange)}
            aria-label="Net worth history range"
            sx={{
                mb: 1.5,
                gap: 0.5,
                "& .MuiToggleButton-root": {
                    border: 0,
                    borderRadius: "10px !important",
                    px: {xs: 1.25, sm: 1.75},
                    py: 0.5,
                    color: "text.secondary",
                    fontWeight: 700,
                    "&.Mui-selected": {
                        color: "primary.light",
                        backgroundColor: "rgba(139,124,255,.14)",
                    },
                },
            }}
        >
            {(Object.keys(RANGE_MONTHS) as RangeKey[]).concat("ALL").map((option) => (
                <ToggleButton key={option} value={option}>{option}</ToggleButton>
            ))}
        </ToggleButtonGroup>

        <Chart
            data={visibleData}
            lines={[{dataKey: "totalNetWorth", stroke: "#8884d8", yAxisId: "right"}]}
            xAxisFormatter={(date: string) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value: number) => `$ ${toFixedString(value / 1000, 0)}k`}
            rightYAxisFormatter={(value: number) => `$ ${toFixedString(value, 0)}`}
            showBrush={visibleData.length > 14}
        /></Card>);
};
