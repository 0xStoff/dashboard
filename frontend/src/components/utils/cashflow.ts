// src/utils/cashflow.ts
export type FlowKind = "deposit" | "withdrawal" | null;

export const toDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);

export const classifyTx = (tx: any): { kind: FlowKind; amount: number } => {
  const type = (tx.type || "").toLowerCase();
  const exchange = (tx.exchange || "").toLowerCase();
  const status = (tx.status || "").toLowerCase();

  // Normalize amount
  let amount = 0;
  if (exchange === "gnosis pay") {
    // transactionAmount stored as CHF cents in your DB
    amount = (Number(tx.transactionAmount) || 0) / 100;
  } else {
    amount = Number(tx.amount) || 0;
  }

  // Deposits
  if (["deposit", "credit card", "bank transfer"].includes(type)) {
    return { kind: "deposit", amount: Math.abs(amount) };
  }
  // Explicit withdrawals
  if (type === "withdrawal") {
    return { kind: "withdrawal", amount: Math.abs(amount) };
  }
  // Gnosis Pay card spend as withdrawals (settled)
  if (exchange === "gnosis pay" && type === "transaction") {
    const settled =
      ["approved", "completed", "success", "successful"].some((s) =>
        status.includes(s)
      ) || !status;
    return { kind: settled ? "withdrawal" : null, amount: Math.abs(amount) };
  }

  return { kind: null, amount: 0 };
};

export type CashflowPoint = {
  date: string;        // YYYY-MM-DD
  deposits: number;    // daily deposits
  withdrawals: number; // daily withdrawals (positive)
  net: number;         // deposits - withdrawals
  netCumulative: number;
};

export function buildCashflowSeries(
  transactions: any[],
  gnosisTransactions: any[],
  startDate: Date,
  endDate: Date
): CashflowPoint[] {
  // Shape Gnosis Pay to match classification
  const gnosisForAggregation = (gnosisTransactions || []).map((tx) => ({
    exchange: "Gnosis Pay",
    type: "transaction",
    transactionAmount: tx.transactionAmount,
    status: tx.status,
    date: tx.date,
  }));
  const all = [...(transactions || []), ...gnosisForAggregation];

  // Aggregate per day
  const dayMap = new Map<string, { deposits: number; withdrawals: number }>();
  for (const tx of all) {
    const t = new Date(tx.date);
    if (isNaN(t.getTime())) continue;
    const day = toDay(t);
    const { kind, amount } = classifyTx(tx);
    if (!kind) continue;
    const prev = dayMap.get(day) || { deposits: 0, withdrawals: 0 };
    if (kind === "deposit") {
      dayMap.set(day, { ...prev, deposits: prev.deposits + amount });
    } else {
      dayMap.set(day, { ...prev, withdrawals: prev.withdrawals + amount });
    }
  }

  // Build full daily range
  const days: string[] = [];
  const s = new Date(toDay(startDate));
  const e = new Date(toDay(endDate));
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(toDay(d));
  }

  let cum = 0;
  return days.map((day) => {
    const { deposits = 0, withdrawals = 0 } = dayMap.get(day) || ({} as any);
    const net = deposits - withdrawals;
    cum += net;
    return {
      date: day,
      deposits: +deposits.toFixed(2),
      withdrawals: +withdrawals.toFixed(2),
      net,
      netCumulative: +cum.toFixed(2),
    };
  });
}

// Align NetWorthData with cumulative net flow and compute withdrawal-adjusted values
export function buildWithdrawalAdjustedNetWorth(
  netWorth: { date: string; totalNetWorth: number }[],
  cashflow: CashflowPoint[]
): { date: string; totalNetWorth: number; adjusted: number }[] {
  const cumMap = new Map(cashflow.map((p) => [p.date, p.netCumulative]));
  return netWorth.map((nw) => {
    const cum = cumMap.get(nw.date) ?? 0;
    return {
      ...nw,
      adjusted: +(nw.totalNetWorth - cum).toFixed(2),
    };
  });
}