import React, { useEffect, useState } from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import {useFetchNetWorth} from "../../hooks/useFetchNetWorth";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";
import { useWallets } from "../../context/WalletsContext";

async function defaultFetchRubicSwaps(wallet: string): Promise<any[]> {
  const base = process.env.NEXT_PUBLIC_RUBIC_BACKEND_URL || "https://api.rubic.exchange";
  const root = base.replace(/\/$/, "");
  const url = `${root}/api/v2/trades/crosschain?address=${encodeURIComponent(wallet)}&page=1&pageSize=100&ordering=-created_at`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  // API returns { count, next, previous, results: [...] }
  return Array.isArray(data?.results) ? data.results : [];
}

const TransactionCards = ({
                              approvedSum,
                              transactions,
                              totalFees,
                              fetchRubicSwaps }) => {  const { netWorth , loading} = useFetchNetWorth({latest: true, includeDetails: false});
  const { rate, loading: exchangeLoading } = useUsdToChfRate();
  const wallets = useWallets();

  const totalXmrWithdrawals = transactions
      .filter((tx) => tx.type.toLowerCase() === "withdrawal")
      .reduce((sum, tx) => sum + (parseFloat(tx.chf_value) || 0), 0);

  const [rubicXmrSum, setRubicXmrSum] = useState(0);
  const [rubicLoading, setRubicLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!wallets || wallets.length === 0) {
        if (!cancelled) setRubicXmrSum(0);
        return;
      }
      setRubicLoading(true);
      try {
        let total = 0;
        for (const w of wallets) {
          const swaps = (await (fetchRubicSwaps || defaultFetchRubicSwaps)(w.wallet)) || [];
          for (const s of swaps) {
            const toSym = (
              s.toSymbol || s.to_symbol || s.output_symbol || s.outputSymbol || s?.to_token?.symbol || ""
            ).toString().toLowerCase();
            if (toSym === "xmr" || toSym === "monero") {
              const chf =
                parseFloat(s.to_value_chf) ||
                parseFloat(s.output_value_chf) ||
                parseFloat(s.chf_value) ||
                (s.volume_in_usd ? Number(s.volume_in_usd) * rate : 0) ||
                0;
              total += chf;
            }
          }
        }
        if (!cancelled) setRubicXmrSum(total);
      } finally {
        if (!cancelled) setRubicLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [wallets, fetchRubicSwaps, rate]);

  const totalWithdrawals = transactions
    .filter((tx) => tx.type.toLowerCase() === "withdrawal")
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalDeposits = transactions
    .filter((tx) => ["deposit", "credit card", "bank transfer"].includes(tx.type.toLowerCase()))
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);


  const lastNetWorth = netWorth.totalNetWorth * rate;

  const netWithdrawals = totalWithdrawals - approvedSum - totalXmrWithdrawals - rubicXmrSum;
  const netProfit = totalWithdrawals + totalDeposits - approvedSum - totalXmrWithdrawals - rubicXmrSum - lastNetWorth;

    // const staticData = {
    //     coinbaseWithdrawals: 1460,
    //     weedWithdrawals: 10000,
    //     initialDeposit: 6715.0
    // }

    return (<Container sx={{ display: {md: "flex" }, justifyContent: "space-between", marginBottom: 5 }}>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Deposits</Typography>
        <Typography variant="h4" fontWeight="bold">
          CHF {toFixedString(totalDeposits, 0)}
        </Typography>
      </Card>

    <Tooltip title={
      <Box>
        <Typography variant="body2">gnosis {toFixedString(approvedSum, 0)} CHF</Typography>
        <Typography variant="body2">kraken {toFixedString(totalWithdrawals, 0)} CHF</Typography>
        <Typography variant="body2">kraken xmr {toFixedString(totalXmrWithdrawals, 0)} CHF</Typography>
        <Typography variant="body2">rubic → XMR {toFixedString(rubicXmrSum, 0)} CHF</Typography>
        {/*<Typography variant="body2">coinbase ${staticData.coinbaseWithdrawals} CHF</Typography>*/}
        {/*<Typography variant="body2">weed ca ${staticData.weedWithdrawals} CHF</Typography>*/}
      </Box>
    } arrow>
        <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
          <Typography variant="h5">Withdrawals</Typography>
          <Typography variant="h4" fontWeight="bold">
            CHF {toFixedString(netWithdrawals, 0)}
          </Typography>
        </Card>
      </Tooltip>

      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Fees</Typography>
        <Typography variant="h4" fontWeight="bold">
          CHF {toFixedString(totalFees, 0)}
        </Typography>
      </Card>

    <Tooltip title={
      loading ? "Loading..." : (
        <Box>
          <Typography variant="body2">+ total withdrawals: CHF {toFixedString(totalWithdrawals, 0)}</Typography>
          <Typography variant="body2">- gnosis (approved): CHF {toFixedString(approvedSum, 0)}</Typography>
          <Typography variant="body2">- kraken xmr: CHF {toFixedString(totalXmrWithdrawals, 0)}</Typography>
          <Typography variant="body2">- rubic → XMR: CHF {toFixedString(rubicXmrSum, 0)}</Typography>
          <Typography variant="body2">- total deposits: CHF {toFixedString(totalDeposits, 0)}</Typography>
          <Typography variant="body2">- networth: CHF {toFixedString(lastNetWorth, 0)}</Typography>
        </Box>
      )
    } arrow>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Net Profit</Typography>
        <Typography variant="h4" fontWeight="bold">
          {loading || exchangeLoading || rubicLoading ? "Loading..." : `CHF ${toFixedString(netProfit, 0)}`}
        </Typography>
      </Card>
    </Tooltip>

    </Container>);
};

export default TransactionCards;