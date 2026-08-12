import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { Position } from "../../interfaces";
import { ColoredChip } from "../utils/ChipWithTooltip";
import { toFixedString } from "../../utils/number-utils";
import ProtocolLogoStack from "./ProtocolLogoStack";

const ProtocolPositionRow: React.FC<{ position: Position }> = ({ position }) => (
    <Box sx={{ py: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                <ProtocolLogoStack isMobile={false} tokenNames={position.tokenNames} urls={position.logoUrls} />
                <Box minWidth={0}><Typography fontWeight={700} noWrap>{position.tokenNames}</Typography><Typography variant="caption" color="text.secondary">{position.type}</Typography></Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {position.wallets.map((wallet, index) => <ColoredChip key={`${wallet.tag}-${index}`} label={wallet.tag} variant="outlined" size="small" fillPercentage={100} />)}
                <Box textAlign="right" minWidth={110}><Typography fontWeight={800}>$ {toFixedString(position.usdValue)}</Typography><Typography variant="caption" color="text.secondary">current value</Typography></Box>
            </Stack>
        </Stack>
        <Divider sx={{ mt: 2 }} />
    </Box>
);

export default ProtocolPositionRow;
