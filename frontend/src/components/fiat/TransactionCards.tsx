import React from "react";
import { Card, Chip, Tooltip, Typography } from "@mui/material";
import { Box } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import { TransactionTotals } from "../../utils/transaction-calculations";

interface TransactionCardsProps {
    activityStats: {
        includedTransactions: number;
        cardPayments: number;
        excludedTransactions: number;
    };
    gnosisSpending: number;
    totals: TransactionTotals;
}

const TransactionCards: React.FC<TransactionCardsProps> = ({
    activityStats,
    gnosisSpending,
    totals,
}) => {
    const totalOutflows =
        totals.fiatWithdrawals +
        totals.xmrWithdrawals +
        totals.rubicWithdrawals +
        gnosisSpending;
    const netCashReturned = totalOutflows - totals.deposits;
    const averageCardPayment = activityStats.cardPayments
        ? gnosisSpending / activityStats.cardPayments
        : 0;

    const statCard = (label: string, value: number, detail: string, tone?: string) => (
        <Card sx={{ padding: { xs: 2.25, sm: 3 }, borderRadius: 4, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={800}>{label}</Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ mt: .4, color: tone || "text.primary" }}>
                CHF {toFixedString(value, 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .6 }}>{detail}</Typography>
        </Card>
    );

    return (
        <Box sx={{ marginY: 3, marginBottom: 4 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
            <Tooltip
                title={
                    <Box>
                        <Typography variant="body2">
                            Binance deposits: CHF {toFixedString(totals.depositBreakdown.binance, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Cash-funded deposits: CHF {toFixedString(totals.depositBreakdown.cash, 0)}
                        </Typography>
                        <Typography variant="body2">
                            Coinbase deposits: CHF {toFixedString(totals.depositBreakdown.coinbase, 0)}
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
                {statCard("Deposits", totals.deposits, "Funds added in this period")}
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
                {statCard("Value taken out", totalOutflows, "Spending and withdrawals")}
            </Tooltip>

            {statCard(
                "Net cash returned",
                netCashReturned,
                "Value taken out minus deposits",
                netCashReturned >= 0 ? "success.main" : "error.main"
            )}
            {statCard("Fees", totals.fees, "Included exchange fees")}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
            <Chip label={`${activityStats.includedTransactions} included transactions`} variant="outlined" />
            <Chip label={`${activityStats.cardPayments} card payments`} variant="outlined" />
            <Chip label={`CHF ${toFixedString(averageCardPayment, 0)} average card payment`} variant="outlined" />
            {activityStats.excludedTransactions > 0 && (
                <Chip label={`${activityStats.excludedTransactions} excluded`} color="warning" variant="outlined" />
            )}
          </Box>
        </Box>
    );
};

export default TransactionCards;
