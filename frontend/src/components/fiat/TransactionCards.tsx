import React from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { toFixedString } from "../../utils/number-utils";
import { useFetchNetWorth } from "../../hooks/useFetchNetWorth";
import { TransactionTotals } from "../../utils/transaction-calculations";

interface TransactionCardsProps {
    gnosisSpending: number;
    totals: TransactionTotals;
    usdToChfRate: number | null;
    exchangeRateLoading: boolean;
    exchangeRateError: boolean;
}

const TransactionCards: React.FC<TransactionCardsProps> = ({
    gnosisSpending,
    totals,
    usdToChfRate,
    exchangeRateLoading,
    exchangeRateError,
}) => {
    const { netWorth, loading } = useFetchNetWorth({ latest: true, includeDetails: false });

    const lastNetWorth = usdToChfRate === null
        ? null
        : (netWorth[0]?.totalNetWorth || 0) * usdToChfRate;
    const totalOutflows =
        totals.fiatWithdrawals +
        totals.xmrWithdrawals +
        totals.rubicWithdrawals +
        gnosisSpending;
    const netProfit = (lastNetWorth || 0) + totalOutflows - totals.deposits;
    const formattedNetProfit = `${netProfit < 0 ? "−" : ""}CHF ${toFixedString(
        Math.abs(netProfit),
        0
    )}`;

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

            <Tooltip
                title={
                    loading ? (
                        "Loading..."
                    ) : (
                        <Box>
                            <Typography variant="body2">
                                + current net worth: CHF {toFixedString(lastNetWorth || 0, 0)}
                            </Typography>
                            <Typography variant="body2">
                                + value taken out: CHF {toFixedString(totalOutflows, 0)}
                            </Typography>
                            <Typography variant="body2">
                                − deposits: CHF {toFixedString(totals.deposits, 0)}
                            </Typography>
                        </Box>
                    )
                }
                arrow
            >
                <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                    <Typography variant="h5">Portfolio profit</Typography>
                    <Typography variant="h4" fontWeight="bold">
                        {loading || exchangeRateLoading
                            ? "Loading..."
                            : exchangeRateError || lastNetWorth === null
                                ? "Rate unavailable"
                                : formattedNetProfit}
                    </Typography>
                </Card>
            </Tooltip>
        </Container>
    );
};

export default TransactionCards;
