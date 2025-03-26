import React from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import {useFetchNetWorth} from "../../hooks/useFetchNetWorth";

const TransactionCards = ({ approvedSum, transactions }) => {
  const { netWorth , loading} = useFetchNetWorth();

  const totalXmrWithdrawals = transactions
      .filter((tx) => tx.type.toLowerCase() === "withdrawal")
      .reduce((sum, tx) => sum + (parseFloat(tx.chf_value) || 0), 0);

  const totalWithdrawals = transactions
    .filter((tx) => tx.type.toLowerCase() === "withdrawal")
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalDeposits = transactions
    .filter((tx) => ["deposit", "credit card", "bank transfer"].includes(tx.type.toLowerCase()))
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalFees = transactions.reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);

  const staticData = {
  coinbaseWithdrawals: 1460,
  weedWithdrawals: 6000,
  initialDeposit: 6715.0
  }
  const lastNetWorth = (netWorth?.[netWorth.length - 1]?.totalNetWorth || 0) * 0.9;

  const netWithdrawals = totalWithdrawals - staticData.coinbaseWithdrawals - staticData.weedWithdrawals - approvedSum - totalXmrWithdrawals;
  const totalDepositsWithInitial = totalDeposits + staticData.initialDeposit;
  const netProfit = totalWithdrawals + totalDepositsWithInitial - staticData.coinbaseWithdrawals - staticData.weedWithdrawals - approvedSum - totalXmrWithdrawals - lastNetWorth;

  return (<Container sx={{ display: {md: "flex" }, justifyContent: "space-between", marginBottom: 5 }}>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Deposits</Typography>
        <Typography variant="h4" fontWeight="bold">
          CHF {toFixedString(totalDepositsWithInitial, 0)}
        </Typography>
      </Card>

    <Tooltip title={
      <Box>
        <Typography variant="body2">gnosis {toFixedString(approvedSum, 0)} CHF</Typography>
        <Typography variant="body2">kraken {toFixedString(totalWithdrawals, 0)} CHF</Typography>
        <Typography variant="body2">kraken xmr {toFixedString(totalXmrWithdrawals, 0)} CHF</Typography>
        <Typography variant="body2">coinbase ${staticData.coinbaseWithdrawals} CHF</Typography>
        <Typography variant="body2">weed ca ${staticData.weedWithdrawals} CHF</Typography>
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
          <Typography variant="body2">+ total withdrawals: CHF {toFixedString(netWithdrawals, 0)}</Typography>
          <Typography variant="body2">+ networth (0.9x): CHF {toFixedString(lastNetWorth, 0)}</Typography>
          <Typography variant="body2">- total deposits: CHF {toFixedString(totalDepositsWithInitial, 0)}</Typography>
        </Box>
      )
    } arrow>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Net Profit</Typography>
        <Typography variant="h4" fontWeight="bold">
          {loading ? "Loading..." : `CHF ${toFixedString(netProfit, 0)}`}
        </Typography>
      </Card>
    </Tooltip>

    </Container>);
};

export default TransactionCards;