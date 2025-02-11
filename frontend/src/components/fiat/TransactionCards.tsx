import React from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";

const TransactionCards = ({ approvedSum, transactions }) => {

  const totalWithdrawals = transactions
    .filter((tx) => tx.type.toLowerCase() === "withdrawal")
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalDeposits = transactions
    .filter((tx) => ["deposit", "fiat payment", "fiat order"].includes(tx.type.toLowerCase()))
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalFees = transactions.reduce((sum, tx) => sum + (parseFloat(tx.fee) || 0), 0);


  return (<Container sx={{ display: {md: "flex" }, justifyContent: "space-between", marginBottom: 5 }}>
      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Deposits</Typography>
        <Typography variant="h4" fontWeight="bold">
          CHF {toFixedString(totalDeposits + 6715.0)}
        </Typography>
      </Card>


    <Tooltip title={
      <Box>
        <Typography variant="body2">gnosis {toFixedString(approvedSum)} CHF</Typography>
        <Typography variant="body2">kraken {toFixedString(totalWithdrawals)} CHF</Typography>
        <Typography variant="body2">coinbase 1460.00 CHF</Typography>
        <Typography variant="body2">weed ca 6000.00 CHF</Typography>
      </Box>
    } arrow>
        <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
          <Typography variant="h5">Withdrawals</Typography>
          <Typography variant="h4" fontWeight="bold">
            CHF {toFixedString(totalWithdrawals - 1460 - 6000 - approvedSum)}
          </Typography>
        </Card>
      </Tooltip>

      <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
        <Typography variant="h5">Fees</Typography>
        <Typography variant="h4" fontWeight="bold">
          CHF {toFixedString(totalFees)}
        </Typography>
      </Card>
    </Container>);
};

export default TransactionCards;