import React, {useEffect, useState} from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import {useFetchNetWorth} from "../../hooks/useFetchNetWorth";
import axios from "axios";

const fetchUsdToChfRate = async () => {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: "usd",
        vs_currencies: "chf",
        x_cg_demo_api_key: process.env.REACT_APP_COINGECKO_API_KEY,
      },
    });
    return response.data.usd?.chf ?? null;
  } catch (error) {
    console.error("Error fetching USD to CHF rate:", error);
    return null;
  }
};

const TransactionCards = ({ approvedSum, transactions, totalFees }) => {
  const { netWorth , loading} = useFetchNetWorth({latest: true, includeDetails: false});
  const [rate, setRate] = useState(1);
  const [exchangeLoading, setExchangeLoading] = useState(true);

  useEffect(() => {
    const getRate = async () => {
      setExchangeLoading(true);
      const fetchedRate = await fetchUsdToChfRate();
      if (fetchedRate) setRate(fetchedRate);
      setExchangeLoading(false);
    };
    getRate();
  }, []);

  const totalXmrWithdrawals = transactions
      .filter((tx) => tx.type.toLowerCase() === "withdrawal")
      .reduce((sum, tx) => sum + (parseFloat(tx.chf_value) || 0), 0);

  const totalWithdrawals = transactions
    .filter((tx) => tx.type.toLowerCase() === "withdrawal")
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalDeposits = transactions
    .filter((tx) => ["deposit", "credit card", "bank transfer"].includes(tx.type.toLowerCase()))
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  // const staticData = {
  // coinbaseWithdrawals: 1460,
  // weedWithdrawals: 10000,
  // initialDeposit: 6715.0
  // }
  const lastNetWorth = netWorth.totalNetWorth * rate;

  const netWithdrawals = totalWithdrawals - approvedSum - totalXmrWithdrawals;
  const netProfit = totalWithdrawals + totalDeposits - approvedSum - totalXmrWithdrawals - lastNetWorth;

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
          <Typography variant="body2">+ total withdrawals: CHF {toFixedString(netWithdrawals, 0)}</Typography>
          <Typography variant="body2">+ networth: CHF {toFixedString(lastNetWorth, 0)}</Typography>
          <Typography variant="body2">- total deposits: CHF {toFixedString(totalDeposits, 0)}</Typography>
        </Box>
      )
    } arrow>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Net Profit</Typography>
        <Typography variant="h4" fontWeight="bold">
          {loading || exchangeLoading ? "Loading..." : `CHF ${toFixedString(netProfit, 0)}`}
        </Typography>
      </Card>
    </Tooltip>

    </Container>);
};

export default TransactionCards;