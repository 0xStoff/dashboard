import React, { useMemo, useState } from "react";
import {NetWorthData} from "../../interfaces";
import Chart from "../utils/Chart";
import {toFixedString} from "../../utils/number-utils";
import {Button, Stack, Switch, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useFetchTransactions from "../../hooks/useFechTransactions";
import { buildCashflowSeries, buildWithdrawalAdjustedNetWorth } from "../utils/cashflow";

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


export const NetWorthChart: React.FC<Props> = ({
                                                   netWorthHistory,
                                                   transactions,
                                                   gnosisTransactions,
                                                   startDate,
                                                   endDate
                                               }) => {
    const cashflow = useMemo(
        () => buildCashflowSeries(transactions, gnosisTransactions, startDate, endDate),
        [transactions, gnosisTransactions, startDate, endDate]
    );

    const series = useMemo(
        () => buildWithdrawalAdjustedNetWorth(netWorthHistory, cashflow),
        [netWorthHistory, cashflow]
    );

    const { transactions } = useFetchTransactions();
    const [showAdjusted, setShowAdjusted] = useState(false);

    // Average-by-day net worth
    const processedData: { date: string; totalNetWorth: number }[] = useMemo(() => processDailyData(data), [data]);

    // Build daily cash flow (CHF) and cumulative sums
    const cashflowByDay = useMemo(() => {
        const map: Record<string, { deposit: number; withdrawal: number }> = {};
        transactions.forEach((tx: any) => {
            const t = (tx.type || '').toLowerCase();
            const date = new Date(tx.date || tx.timestamp).toISOString().split('T')[0];
            if (!map[date]) map[date] = { deposit: 0, withdrawal: 0 };
            const amount = parseFloat(tx.chf_value ?? tx.amount ?? 0) || 0;
            if (["deposit", "credit card", "bank transfer"].includes(t)) {
                map[date].deposit += amount;
            } else if (t === "withdrawal") {
                map[date].withdrawal += amount;
            }
        });
        return map;
    }, [transactions]);

    const mergedData = useMemo(() => {
        let cumDep = 0;
        let cumWdr = 0;
        return processedData.map(d => {
            const flows = cashflowByDay[d.date] || { deposit: 0, withdrawal: 0 };
            cumDep += flows.deposit;
            cumWdr += flows.withdrawal;
            const pnlAdjusted = (d.totalNetWorth ?? 0) + cumWdr - cumDep;
            return {
                ...d,
                cumDeposits: cumDep,
                cumWithdrawals: cumWdr,
                pnlAdjusted,
            };
        });
    }, [processedData, cashflowByDay]);

    const startDate = new Date("2025-01-25T23:33:42.697Z").toISOString().split("T")[0];

    const lines = useMemo(() => {
        const base = [
            { dataKey: showAdjusted ? "pnlAdjusted" : "totalNetWorth", stroke: showAdjusted ? "#ff9800" : "#8884d8", yAxisId: "right" },
            { dataKey: "cumDeposits", stroke: "#4caf50", yAxisId: "right" },
            { dataKey: "cumWithdrawals", stroke: "#f44336", yAxisId: "right" },
        ];
        return base;
    }, [showAdjusted]);

    return (<>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 5 }}>
            <Button
                onClick={() => setShowChart(false)}
                variant="text"
                size="small"
                sx={{ color: '#f44336', minWidth: 'auto', padding: '4px', fontWeight: 'bold', borderRadius: '50%' }}
            >
                <CloseIcon fontSize="small" />
            </Button>
            <Typography variant="body2">Withdrawal-adjusted</Typography>
            <Switch size="small" checked={showAdjusted} onChange={() => setShowAdjusted(v => !v)} />
        </Stack>
        <Chart
            data={mergedData}
            lines={lines}
            xAxisFormatter={(date) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
            rightYAxisFormatter={(value) => `$ ${toFixedString(value, 0)}`}
            referenceLineX={startDate}
        />
    </>);
};