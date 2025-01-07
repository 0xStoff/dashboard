import React from "react";
import { AttachMoney, MoneyOff, Receipt } from "@mui/icons-material";
import { Container, Typography, Grid } from "@mui/material";

const SummaryWithIcons = ({ totalDeposits, totalWithdrawals, totalFees }) => (
    <Container>
        <Typography
            variant="h4"
            gutterBottom
            style={{
                textAlign: "center",
                fontWeight: "bold",
                marginBottom: "2rem",
                color: "#3f51b5",
            }}
        >
            Transactions Summary
        </Typography>
        <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={4}>
                <Typography
                    variant="h6"
                    gutterBottom
                    style={{
                        display: "flex",
                        alignItems: "center",
                        color: "#4caf50",
                    }}
                >
                    <AttachMoney style={{ marginRight: "8px" }} />
                    Total Deposits: <strong> {totalDeposits.toFixed(2)} EUR</strong>
                </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Typography
                    variant="h6"
                    gutterBottom
                    style={{
                        display: "flex",
                        alignItems: "center",
                        color: "#f44336",
                    }}
                >
                    <MoneyOff style={{ marginRight: "8px" }} />
                    Total Withdrawals: <strong> {totalWithdrawals.toFixed(2)} EUR</strong>
                </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
                <Typography
                    variant="h6"
                    gutterBottom
                    style={{
                        display: "flex",
                        alignItems: "center",
                        color: "#ff9800",
                    }}
                >
                    <Receipt style={{ marginRight: "8px" }} />
                    Total Fees: <strong> {totalFees.toFixed(2)} CHF</strong>
                </Typography>
            </Grid>
        </Grid>
    </Container>
);

export default SummaryWithIcons;