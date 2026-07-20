import React from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import { TransactionTotals } from "../../utils/transaction-calculations";

interface TransactionCardsProps {
    gnosisSpending: number;
    totals: TransactionTotals;
}

const TransactionCards: React.FC<TransactionCardsProps> = ({
    gnosisSpending,
    totals,
}) => {
    const totalOutflows =
        totals.fiatWithdrawals +
        totals.xmrWithdrawals +
        totals.rubicWithdrawals +
        gnosisSpending;

    return (
        <Container sx={{ display: { md: "flex" }, justifyContent: "space-between", marginBottom: 5 }}>
            <Tooltip
                title={
                    <Box>
                        <Typography variant="body2">
                            Binance deposits: CHF {toFixedString(totals.depositBreakdown.binance, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Kraken CHF deposits: CHF {toFixedString(totals.depositBreakdown.krakenChf, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Kraken EUR deposits: CHF {toFixedString(totals.depositBreakdown.krakenEur, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Kraken XMR deposits: CHF {toFixedString(totals.depositBreakdown.krakenXmr, 0)}
                        </Typography>
                    </Box>
                }
                arrow
            >
                <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                    <Typography variant="h5">Deposits</Typography>
                    <Typography variant="h4" fontWeight="bold">
                        CHF {toFixedString(totals.deposits, 0)}
                    </Typography>
                </Card>
            </Tooltip>

            <Tooltip
                title={
                    <Box>
                        <Typography variant="body2">
                            Gnosis Pay spending: CHF {toFixedString(gnosisSpending, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Fiat withdrawals: CHF {toFixedString(totals.fiatWithdrawals, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Kraken XMR withdrawals: CHF {toFixedString(totals.xmrWithdrawals, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Rubic XMR: CHF {toFixedString(totals.rubicWithdrawals, 0)}
                        </Typography>
                    </Box>
                }
                arrow
            >
                <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                    <Typography variant="h5">Value taken out</Typography>
                    <Typography variant="h4" fontWeight="bold">
                        CHF {toFixedString(totalOutflows, 0)}
                    </Typography>
                </Card>
            </Tooltip>

            <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                <Typography variant="h5">Fees</Typography>
                <Typography variant="h4" fontWeight="bold">
                    CHF {toFixedString(totals.fees, 0)}
                </Typography>
            </Card>

        </Container>
    );
};

export default TransactionCards;
