import React from "react";
import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine} from "recharts";
import {Card, Typography} from "@mui/material";
import {formatNumber, toFixedString} from "../../utils/number-utils";

const Chart = ({data, lines, xAxisFormatter, leftYAxisFormatter, rightYAxisFormatter, referenceLineX,}) => {
    if (!data || data.length === 0) return null;

    return (<ResponsiveContainer width="100%" height={400} style={{margin: 30}}>
        <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3"/>

            <XAxis
                dataKey="date"
                tickFormatter={xAxisFormatter}
                interval={Math.ceil(data.length / 5)}
            />

            <YAxis
                yAxisId="left"
                tickFormatter={leftYAxisFormatter}
                domain={[0, "auto"]}
            />

            <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={rightYAxisFormatter}
                domain={[0, "auto"]}
            />

            {referenceLineX && <ReferenceLine x={referenceLineX} strokeWidth={2} stroke="#8884d8" yAxisId="right"/>}
            <Tooltip
                content={({payload, label, active}) => {
                    if (active && payload && payload.length) {
                        const index = data.findIndex((d) => d.date === label);
                        const currentData = data[index] || {};
                        const currentValue = currentData.totalNetWorth ?? currentData.usdValue ?? currentData.pnlAdjusted;
                        const balance = currentData.balance ?? 0;
                        const dep = currentData.cumDeposits ?? 0;
                        const wdr = currentData.cumWithdrawals ?? 0;
                        const pnlAdj = currentData.pnlAdjusted ?? null;

                        return (<Card sx={{borderRadius: "10px", padding: "15px"}}>
                            <Typography fontWeight="bold">{`$ ${toFixedString(currentValue, 2)}`}</Typography>
                            {pnlAdj !== null && <Typography>{`Adj: $ ${toFixedString(pnlAdj, 2)}`}</Typography>}
                            {(dep || wdr) ? (
                                <>
                                    <Typography>{`Deposits: $ ${toFixedString(dep, 0)}`}</Typography>
                                    <Typography>{`Withdrawals: $ ${toFixedString(wdr, 0)}`}</Typography>
                                </>
                            ) : null}
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
                strokeWidth={2}
                dot={false}
                activeDot={{r: 6}}
            />))}
        </LineChart>
    </ResponsiveContainer>);
};

export default Chart;