import React from "react";
import { Box, Chip, Grid, Typography } from "@mui/material";
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
                        <ColoredChip
                            key={`${wallet.tag}-${index}`}
                            label={wallet.tag}
                            variant="outlined"
                            size="small"
                            fillPercentage={100}
                        />
                    ))}
                </Box>
            </Grid>

            {!isMobile && (
                <Grid item md={2}>
                    <Typography align="right">$ {formatNumber(position.price, "price")}</Typography>
                </Grid>
            )}

            {!isMobile && (
                <Grid item md={1}>
                    <Typography align="right">{formatNumber(position.amount, "amount")}</Typography>
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
