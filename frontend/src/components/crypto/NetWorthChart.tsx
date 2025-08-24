import React, { useMemo } from "react";
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import {
    buildCashflowSeries,
    buildWithdrawalAdjustedNetWorth,
} from "../utils/cashflow";

type NetWorthData = {
    date: string;
    totalNetWorth: number;
    // tokenHistory/protocolHistory omitted for brevity
};

type Props = {
    netWorthHistory: NetWorthData[];
    transactions: any[];
    gnosisTransactions: any[];
    startDate: Date;
    endDate: Date;
};

const NetWorthChart: React.FC<Props> = ({
                                            netWorthHistory,
                                            transactions,
                                            gnosisTransactions,
                                            startDate,
                                            endDate,
                                        }) => {
    const cashflow = useMemo(
        () =>
            buildCashflowSeries(
                transactions,
                gnosisTransactions,
                startDate,
                endDate
            ),
        [transactions, gnosisTransactions, startDate, endDate]
    );

    const series = useMemo(
        () => buildWithdrawalAdjustedNetWorth(netWorthHistory, cashflow),
        [netWorthHistory, cashflow]
    );

    return (
        <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
                <ComposedChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" minTickGap={32} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                        name="Net worth"
                        dataKey="totalNetWorth"
                        stroke="#64b5f6"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        name="Withdrawal-adjusted"
                        dataKey="adjusted"
                        stroke="#c792ea"
                        strokeWidth={2}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default NetWorthChart;