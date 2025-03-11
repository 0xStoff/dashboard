import React from "react";
import {NetWorthData} from "../../interfaces";
import Chart from "../utils/Chart";
import {toFixedString} from "../../utils/number-utils";

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


export const NetWorthChart = ({data}) => {
    const processedData: NetWorthData[] = processDailyData(data);
    const startDate = new Date("2025-01-25T23:33:42.697Z").toISOString().split("T")[0];

    return (<Chart
            data={processedData}
            lines={[{dataKey: "totalNetWorth", stroke: "#8884d8", yAxisId: "right"}]}
            xAxisFormatter={(date) => new Date(date).toLocaleDateString("de-CH", {month: "short", day: "2-digit"})}
            leftYAxisFormatter={(value) => `$ ${toFixedString(value / 1000, 0)}k`}
            rightYAxisFormatter={(value) => `$ ${toFixedString(value, 0)}`}
            referenceLineX={startDate}
        />);
};