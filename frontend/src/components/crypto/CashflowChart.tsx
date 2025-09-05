// CashflowChart.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
  CartesianGrid,
} from "recharts";

type CashflowPoint = {
  date: string; // YYYY-MM-DD
  deposits: number; // >0
  withdrawals: number; // >0 (shown positive for bar)
  net: number; // deposits - withdrawals (per day)
  netCumulative: number; // cumulative sum of net up to day
  adjusted?: number; // optional, computed if holdings provided
};

type HoldingPoint = {
  date: string;            // YYYY-MM-DD
  value: number;           // portfolio value that day
};

type Props = {
  data: CashflowPoint[];
  holdingsSeries?: HoldingPoint[]; // optional; if provided, adjusted line will be available
  height?: number;
};

const mergeAdjustedSeries = (cf: CashflowPoint[], holdings?: HoldingPoint[]) => {
  if (!holdings || holdings.length === 0) return cf;

  // Build a quick date->cumulative map
  const cumByDate = new Map(cf.map(d => [d.date, d.netCumulative]));
  const merged = cf.map(d => ({ ...d }));

  // Align by date; if holdings has extra dates not in cf, we’ll ignore them
  const holdByDate = new Map(holdings.map(h => [h.date, h.value]));
  for (const row of merged) {
    const v = holdByDate.get(row.date);
    if (typeof v === "number") {
      const cum = cumByDate.get(row.date) ?? 0;
      row.adjusted = v - cum;
    }
  }
  return merged;
};

const CashflowChart: React.FC<Props> = ({ data, holdingsSeries, height = 320 }) => {
  const [showBars, setShowBars] = useState(true);
  const [showCumNet, setShowCumNet] = useState(true);
  const [showAdjusted, setShowAdjusted] = useState(true);

  const chartData = useMemo(
    () => mergeAdjustedSeries(data, holdingsSeries),
    [data, holdingsSeries]
  );

  return (
    <div style={{ width: "100%", height }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showBars}
            onChange={(e) => setShowBars(e.target.checked)}
          />{" "}
          Show deposits/withdrawals
        </label>
        <label style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showCumNet}
            onChange={(e) => setShowCumNet(e.target.checked)}
          />{" "}
          Show cumulative net flow
        </label>
        {holdingsSeries && (
          <label style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showAdjusted}
              onChange={(e) => setShowAdjusted(e.target.checked)}
            />{" "}
            Show withdrawal-adjusted value
          </label>
        )}
      </div>

      <ResponsiveContainer>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" minTickGap={32} />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />

          {showBars && (
            <>
              <Bar
                name="Deposits"
                yAxisId="left"
                dataKey="deposits"
                stackId="cf"
                fill="#4caf50"
                opacity={0.85}
              />
              <Bar
                name="Withdrawals"
                yAxisId="left"
                dataKey="withdrawals"
                stackId="cf"
                fill="#f44336"
                opacity={0.85}
              />
            </>
          )}

          {showCumNet && (
            <Line
              name="Cumulative net flow"
              yAxisId="right"
              type="monotone"
              dataKey="netCumulative"
              stroke="#90caf9"
              strokeWidth={2}
              dot={false}
            />
          )}

          {holdingsSeries && showAdjusted && (
            <Line
              name="Withdrawal-adjusted"
              yAxisId="right"
              type="monotone"
              dataKey="adjusted"
              stroke="#c792ea"
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CashflowChart;