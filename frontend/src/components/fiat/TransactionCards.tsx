import React, { useMemo } from "react";
import { Card, Tooltip, Typography } from "@mui/material";
import { Box, Container } from "@mui/system";
import { TransactionRecord } from "../../interfaces";
import { toFixedString } from "../../utils/number-utils";
import { useFetchNetWorth } from "../../hooks/useFetchNetWorth";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";

interface TransactionCardsProps {
    approvedSum: number;
    transactions: TransactionRecord[];
    totalFees: number;
    rubicXmrSum?: number;
    rubicLoading?: boolean;
}

const isWithdrawal = (transaction: TransactionRecord) => transaction.type.toLowerCase() === "withdrawal";
const isDeposit = (transaction: TransactionRecord) =>
    ["deposit", "credit card", "bank transfer"].includes(transaction.type.toLowerCase());

const TransactionCards: React.FC<TransactionCardsProps> = ({
    approvedSum,
    transactions,
    totalFees,
    rubicXmrSum = 0,
    rubicLoading = false,
}) => {
    const { netWorth, loading } = useFetchNetWorth({ latest: true, includeDetails: false });
    const { rate, loading: exchangeLoading } = useUsdToChfRate();

    const totals = useMemo(() => {
        const totalXmrWithdrawals = transactions
            .filter(isWithdrawal)
            .reduce((sum, transaction) => sum + (Number(transaction.chf_value) || 0), 0);

        const totalWithdrawals = transactions
            .filter(isWithdrawal)
            .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);

        const totalDeposits = transactions
            .filter(isDeposit)
            .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);

        return {
            totalXmrWithdrawals,
            totalWithdrawals,
            totalDeposits,
        };
    }, [transactions]);

    const lastNetWorth = (netWorth?.totalNetWorth || 0) * rate;
    const netWithdrawals =
        totals.totalWithdrawals - approvedSum - totals.totalXmrWithdrawals - rubicXmrSum;
    const netProfit =
        totals.totalWithdrawals +
        totals.totalDeposits -
        approvedSum -
        totals.totalXmrWithdrawals -
        rubicXmrSum -
        lastNetWorth;

    return (
        <Container sx={{ display: { md: "flex" }, justifyContent: "space-between", marginBottom: 5 }}>
            <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                <Typography variant="h5">Deposits</Typography>
                <Typography variant="h4" fontWeight="bold">
                    CHF {toFixedString(totals.totalDeposits, 0)}
                </Typography>
            </Card>

            <Tooltip
                title={
                    <Box>
                        <Typography variant="body2">gnosis {toFixedString(approvedSum, 0)} CHF</Typography>
                        <Typography variant="body2">
                            kraken {toFixedString(totals.totalWithdrawals, 0)} CHF
                        </Typography>
                        <Typography variant="body2">
                            kraken xmr {toFixedString(totals.totalXmrWithdrawals, 0)} CHF
                        </Typography>
                        <Typography variant="body2">
                            rubic xmr {toFixedString(rubicXmrSum, 0)} CHF
                        </Typography>
                    </Box>
                }
                arrow
            >
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

            <Tooltip
                title={
                    loading ? (
                        "Loading..."
                    ) : (
                        <Box>
                            <Typography variant="body2">
                                + total withdrawals: CHF {toFixedString(totals.totalWithdrawals, 0)}
                            </Typography>
                            <Typography variant="body2">
                                - gnosis (approved): CHF {toFixedString(approvedSum, 0)}
                            </Typography>
                            <Typography variant="body2">
                                - kraken xmr: CHF {toFixedString(totals.totalXmrWithdrawals, 0)}
                            </Typography>
                            <Typography variant="body2">
                                - rubic XMR: CHF {toFixedString(rubicXmrSum, 0)}
                            </Typography>
                            <Typography variant="body2">
                                - total deposits: CHF {toFixedString(totals.totalDeposits, 0)}
                            </Typography>
                            <Typography variant="body2">
                                - net worth: CHF {toFixedString(lastNetWorth, 0)}
                            </Typography>
                        </Box>
                    )
                }
                arrow
            >
                <Card sx={{ padding: 3, borderRadius: 10, marginY: 3 }}>
                    <Typography variant="h5">Net Profit</Typography>
                    <Typography variant="h4" fontWeight="bold">
                        {loading || exchangeLoading || rubicLoading ? "Loading..." : `CHF ${toFixedString(netProfit, 0)}`}
                    </Typography>
                </Card>
            </Tooltip>
        </Container>
    );
};

export default TransactionCards;
