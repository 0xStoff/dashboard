import React from "react";
import { Box, Chip, Grid, Tooltip, Typography } from "@mui/material";
import { Position } from "../../interfaces";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { formatNumber, toFixedString } from "../../utils/number-utils";
import ProtocolLogoStack from "./ProtocolLogoStack";

interface ProtocolPositionRowProps {
    isMobile: boolean;
    position: Position;
}

const ProtocolPositionRow: React.FC<ProtocolPositionRowProps> = ({ isMobile, position }) => {
    return (
        <Grid container marginTop={2} alignItems="center" columnSpacing={2}>
            <Grid item xs={12} md={2}>
                <ProtocolLogoStack
                    isMobile={isMobile}
                    tokenNames={position.tokenNames}
                    urls={position.logoUrls}
                />
            </Grid>

            <Grid item xs={12} md={3}>
                <Typography
                    sx={{
                        mt: { xs: 1, md: 0 },
                        overflowWrap: "anywhere",
                    }}
                >
                    {position.tokenNames}
                </Typography>
            </Grid>

            <Grid item xs={12} md={2}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: { xs: 1, md: 0 } }}>
                    <Chip label={position.type} variant="filled" size={isMobile ? "small" : "medium"} />
                    {position.wallets.map((wallet, index) => (
                        <Tooltip
                            key={`${wallet.tag}-${index}`}
                            arrow
                            title={`${toFixedString(position.usdValue > 0 ? wallet.usdValue / position.usdValue * 100 : 0)}% / $ ${toFixedString(wallet.usdValue)}${position.tokenCount === 1 ? ` / ${formatNumber(wallet.amount, "amount")} ${position.tokenNames}` : ""}`}
                        >
                            <span>
                                <ColoredChip
                                    label={wallet.tag}
                                    variant="outlined"
                                    size="small"
                                    fillPercentage={position.usdValue > 0 ? wallet.usdValue / position.usdValue * 100 : 0}
                                    onClick={(event) => event.stopPropagation()}
                                />
                            </span>
                        </Tooltip>
                    ))}
                </Box>
            </Grid>

            {!isMobile && (
                <Grid item md={2}>
                    <Typography align="right">
                        {position.tokenCount === 1 ? `$ ${formatNumber(position.price, "price")}` : "—"}
                    </Typography>
                </Grid>
            )}

            {!isMobile && (
                <Grid item md={1}>
                    <Typography align="right">
                        {position.tokenCount === 1 ? formatNumber(position.amount, "amount") : "Multiple"}
                    </Typography>
                </Grid>
            )}

            <Grid item xs={12} md={2}>
                <Typography align="right" fontWeight="bold" sx={{ mt: { xs: 1, md: 0 } }}>
                    $ {toFixedString(position.usdValue)}
                </Typography>
            </Grid>
        </Grid>
    );
};

export default ProtocolPositionRow;
