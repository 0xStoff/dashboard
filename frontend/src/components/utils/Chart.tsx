import React from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine} from "recharts";
import {Box, Card, Typography, useMediaQuery, useTheme} from "@mui/material";
import {formatNumber, toFixedString} from "../../utils/number-utils";

const Chart = ({data, lines, xAxisFormatter, leftYAxisFormatter, rightYAxisFormatter, referenceLineX,}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    if (!data || data.length === 0) return null;

    return (<Box sx={{width: '100%', height: {xs: 280, sm: 360}}}>
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

            {referenceLineX && <ReferenceLine x={referenceLineX} strokeWidth={2} stroke="#8884d8" yAxisId="right"/>}
            <Tooltip
                content={({payload, label, active}) => {
                    if (active && payload && payload.length) {
                        const index = data.findIndex((d) => d.date === label);
                        const currentData = data[index] || {};
                        const currentValue = currentData.totalNetWorth ?? currentData.usdValue;
                        const balance = currentData.balance ?? 0;


                        return (<Card sx={{borderRadius: "10px", padding: "15px"}}>
                            <Typography fontWeight="bold">{`$ ${toFixedString(currentValue, 2)}`}</Typography>
                            {balance ? <Typography>{`Balance: ${formatNumber(balance, "amount")}`}</Typography> : null}
                            <Typography variant="caption">{label}</Typography>
                        </Card>);
                    }
                    return null;
                }}
            />
            {lines.map(({dataKey, stroke, yAxisId}) => (<Line
                key={dataKey}
                yAxisId={yAxisId}
                type="monotone"
                dataKey={dataKey}
                stroke={stroke}
                strokeWidth={2.5}
                dot={false}
                activeDot={{r: 6}}
            />))}
        </LineChart>
      </ResponsiveContainer>
    </Box>);
};

export default Chart;
