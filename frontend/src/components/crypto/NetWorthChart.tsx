import React, {useMemo, useState} from "react";
import {NetWorthData} from "../../interfaces";
import Chart from "../utils/Chart";
import {toFixedString} from "../../utils/number-utils";
import {Box, Card, IconButton, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useFetchTransactions from "../../hooks/useFetchTransactions";
import {useUsdToChfRate} from "../../hooks/useUsdToChfRate";
import {calculateCashFlowEvents, CashFlowEvent} from "../../utils/transaction-calculations";

interface NetWorthChartProps {
    data: NetWorthData[];
    setShowChart: React.Dispatch<React.SetStateAction<boolean>>;
}

const processDailyData = (data: NetWorthData[]) => {
    const groupedData: Record<string, {totalNetWorth: number; count: number}> = {};

    data.forEach((entry: NetWorthData) => {
        const date = new Date(entry.date).toISOString().split("T")[0];
        if (!groupedData[date]) {
            groupedData[date] = {totalNetWorth: 0, count: 0};
        }
        groupedData[date].totalNetWorth += entry.totalNetWorth;
        groupedData[date].count += 1;
    });

    return Object.entries(groupedData)
        .map(([date, values]) => ({
            date,
            totalNetWorth: values.totalNetWorth / values.count,
        }))
        .sort((left, right) => left.date.localeCompare(right.date));
};

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
};

interface AdjustedHistoryPoint {
    date: string;
    totalNetWorth: number;
    adjustedNetWorth: number;
    deposits: number;
    withdrawals: number;
}

const addCashFlowAdjustments = (
    history: ReturnType<typeof processDailyData>,
    events: CashFlowEvent[],
    usdToChfRate: number
): AdjustedHistoryPoint[] => {
    if (!history.length) return [];

    const firstDate = history[0].date;
    let cumulativeNetDepositsUsd = 0;
    // The first visible snapshot is the baseline. Same-day flows cannot be
    // ordered reliably against that snapshot, so adjustment begins the next day.
    let eventIndex = events.findIndex((event) => event.date > firstDate);
    if (eventIndex < 0) eventIndex = events.length;

    return history.map((point) => {
        let deposits = 0;
        let withdrawals = 0;

        while (eventIndex < events.length && events[eventIndex].date <= point.date) {
            const event = events[eventIndex];
            deposits += event.depositsChf / usdToChfRate;
            withdrawals += event.withdrawalsChf / usdToChfRate;
            cumulativeNetDepositsUsd += (event.depositsChf - event.withdrawalsChf) / usdToChfRate;
            eventIndex += 1;
        }

        return {
            ...point,
            adjustedNetWorth: point.totalNetWorth - cumulativeNetDepositsUsd,
            deposits,
            withdrawals,
        };
    });
};

export const NetWorthChart = ({data, setShowChart}: NetWorthChartProps) => {
    const [range, setRange] = useState<RangeKey>("ALL");
    const {transactions, gnosisTransactions, loading: transactionsLoading} = useFetchTransactions();
    const {
        rate: usdToChfRate,
        eurRate: eurToChfRate,
        loading: ratesLoading,
        error: ratesError,
    } = useUsdToChfRate();
    const processedData = useMemo(() => processDailyData(data), [data]);
    const rangedData = useMemo(() => {
        const months = RANGE_MONTHS[range];
        if (!months || !processedData.length) return processedData;

        const cutoff = new Date(processedData[processedData.length - 1].date);
        cutoff.setMonth(cutoff.getMonth() - months);
        return processedData.filter((entry) => new Date(entry.date) >= cutoff);
    }, [processedData, range]);
    const cashFlowEvents = useMemo(
        () => calculateCashFlowEvents(transactions, gnosisTransactions, eurToChfRate || 1),
        [eurToChfRate, gnosisTransactions, transactions]
    );
    const visibleData = useMemo(
        () => addCashFlowAdjustments(rangedData, cashFlowEvents, usdToChfRate || 1),
        [cashFlowEvents, rangedData, usdToChfRate]
    );
    const latestValue = visibleData[visibleData.length - 1]?.totalNetWorth || 0;
    const totalDeposits = visibleData.reduce((sum, point) => sum + point.deposits, 0);
    const totalWithdrawals = visibleData.reduce((sum, point) => sum + point.withdrawals, 0);
    const adjustmentReady = !transactionsLoading && !ratesLoading && Boolean(usdToChfRate && eurToChfRate);

    return (<Card sx={{borderRadius: 4, p: {xs: 2, sm: 3}, mt: 2.5}}>
        <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2}}>
          <Box>
            <Typography variant="h5">Net worth history</Typography>
            <Box sx={{display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap", mt: 0.5}}>
                <Typography variant="h4">$ {toFixedString(latestValue, 0)}</Typography>
                {adjustmentReady && (
                    <Typography variant="body2" color="text.secondary">
                        Deposits $ {toFixedString(totalDeposits, 0)}
                        {" · "}Withdrawals $ {toFixedString(totalWithdrawals, 0)}
                    </Typography>
                )}
            </Box>
            <Typography variant="caption" color="text.secondary">
                {ratesError
                    ? "Cash-flow adjustment is unavailable because exchange rates could not be loaded."
                    : "Flow-adjusted history removes included external cash flows since the start of the selected range."}
            </Typography>
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

        <Box sx={{display: "flex", gap: 2, alignItems: "center", mb: 0.5, flexWrap: "wrap"}}>
            <Box sx={{display: "flex", gap: 0.75, alignItems: "center"}}>
                <Box sx={{width: 18, height: 3, borderRadius: 2, bgcolor: "#8884d8"}} />
                <Typography variant="caption" color="text.secondary">Net worth</Typography>
            </Box>
            {adjustmentReady && (
                <Box sx={{display: "flex", gap: 0.75, alignItems: "center"}}>
                    <Box sx={{width: 18, height: 3, borderRadius: 2, bgcolor: "#5eead4"}} />
                    <Typography variant="caption" color="text.secondary">Flow-adjusted</Typography>
                </Box>
            )}
        </Box>

        <Chart
            data={visibleData}
            lines={[
                {dataKey: "totalNetWorth", stroke: "#8884d8", yAxisId: "right"},
                ...(adjustmentReady
                    ? [{dataKey: "adjustedNetWorth" as const, stroke: "#5eead4", yAxisId: "right" as const}]
                    : []),
            ]}
            xAxisFormatter={(date: string) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value: number) => `$ ${toFixedString(value / 1000, 0)}k`}
            rightYAxisFormatter={(value: number) => `$ ${toFixedString(value, 0)}`}
            showBrush={visibleData.length > 14}
        /></Card>);
};
