import React from "react";
import {
    Brush,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {Box, Card, Typography, useMediaQuery, useTheme} from "@mui/material";
import {formatNumber, toFixedString} from "../../utils/number-utils";

interface ChartDatum {
    date: string;
    balance?: number | null;
    totalNetWorth?: number;
    adjustedNetWorth?: number;
    usdValue?: number;
    deposits?: number;
    withdrawals?: number;
}

interface ChartLine {
    dataKey: keyof ChartDatum;
    stroke: string;
    yAxisId: "left" | "right";
}

interface ChartProps {
    data: ChartDatum[];
    lines: ChartLine[];
    xAxisFormatter: (value: string) => string;
    leftYAxisFormatter: (value: number) => string;
    rightYAxisFormatter: (value: number) => string;
    showBrush?: boolean;
}

const LINE_LABELS: Partial<Record<keyof ChartDatum, string>> = {
    totalNetWorth: "Net worth",
    adjustedNetWorth: "Flow-adjusted",
    usdValue: "Value",
    balance: "Balance",
};

const Chart = ({
    data,
    lines,
    xAxisFormatter,
    leftYAxisFormatter,
    rightYAxisFormatter,
    showBrush = false,
}: ChartProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    if (!data || data.length === 0) return null;

    return (<Box sx={{width: '100%', height: {xs: showBrush ? 330 : 280, sm: showBrush ? 410 : 360}}}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{top: 12, right: isMobile ? 4 : 18, bottom: 4, left: isMobile ? -20 : 4}}>
            <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false}/>

            <XAxis
                dataKey="date"
                tickFormatter={xAxisFormatter}
                interval={Math.ceil(data.length / 5)}
                tick={{fill: theme.palette.text.secondary, fontSize: 12}}
                axisLine={{stroke: 'rgba(255,255,255,.1)'}}
                tickLine={false}
            />

            <YAxis
                yAxisId="left"
                tickFormatter={leftYAxisFormatter}
                domain={[0, "auto"]}
                width={isMobile ? 42 : 64}
                tick={{fill: theme.palette.text.secondary, fontSize: 12}}
                axisLine={false}
                tickLine={false}
            />

            <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={rightYAxisFormatter}
                domain={[0, "auto"]}
                width={isMobile ? 48 : 72}
                tick={{fill: theme.palette.text.secondary, fontSize: 12}}
                axisLine={false}
                tickLine={false}
            />

            <Tooltip
                cursor={{stroke: "rgba(184,175,255,.45)", strokeWidth: 1}}
                content={({payload, label, active}) => {
                    if (active && payload && payload.length) {
                        const index = data.findIndex((datum) => datum.date === label);
                        const currentData = data[index] || {};
                        const balance = currentData.balance ?? 0;

                        return (<Card sx={{
                            borderRadius: 3,
                            p: 1.5,
                            background: "rgba(18,21,31,.92)",
                            backdropFilter: "blur(14px)",
                            boxShadow: "0 14px 40px rgba(0,0,0,.38)",
                        }}>
                            {payload.map((item) => (
                                <Typography key={String(item.dataKey)} fontWeight="bold" sx={{color: item.color}}>
                                    {LINE_LABELS[item.dataKey as keyof ChartDatum] || item.name}:{" "}
                                    {item.dataKey === "balance"
                                        ? formatNumber(Number(item.value) || 0, "amount")
                                        : `$ ${toFixedString(Number(item.value) || 0, 2)}`}
                                </Typography>
                            ))}
                            {balance && !payload.some((item) => item.dataKey === "balance")
                                ? <Typography>{`Balance: ${formatNumber(balance, "amount")}`}</Typography>
                                : null}
                            {currentData.deposits ? (
                                <Typography variant="body2" color="success.main">
                                    Deposits: +$ {toFixedString(currentData.deposits, 2)}
                                </Typography>
                            ) : null}
                            {currentData.withdrawals ? (
                                <Typography variant="body2" color="warning.main">
                                    Withdrawals: −$ {toFixedString(currentData.withdrawals, 2)}
                                </Typography>
                            ) : null}
                            <Typography variant="caption">{label}</Typography>
                        </Card>);
                    }
                    return null;
                }}
            />
            {lines.map(({dataKey, stroke, yAxisId}) => (<Line
                key={String(dataKey)}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={dataKey}
                stroke={stroke}
                strokeWidth={2.5}
                dot={false}
                activeDot={{r: 6}}
            />))}
            {showBrush && (
                <Brush
                    dataKey="date"
                    height={28}
                    travellerWidth={10}
                    stroke={theme.palette.primary.main}
                    fill="rgba(139,124,255,.07)"
                    tickFormatter={xAxisFormatter}
                />
            )}
        </LineChart>
      </ResponsiveContainer>
    </Box>);
};

export default Chart;
