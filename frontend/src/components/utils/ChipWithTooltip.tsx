import React from "react";
import { Chip, ChipProps, Tooltip } from "@mui/material";
import { styled } from "@mui/system";
import { Token, TokenWallet } from "../../interfaces";
import { formatNumber, toFixedString } from "../../utils/number-utils";

interface ColoredChipProps extends ChipProps {
    label: string;
    fillPercentage: number;
}

export const ColoredChip = styled(({ label, fillPercentage, ...other }: ColoredChipProps) => {
    const backgroundColor = "transparent";
    const gradientColor = "rgba(255, 255, 255, 0.16)";
    const gradient = `linear-gradient(90deg, ${gradientColor} ${fillPercentage}%, ${backgroundColor} ${fillPercentage}%)`;

    return <Chip {...other} label={label} style={{ background: gradient }} />;
})<ColoredChipProps>(() => ({
    margin: 5,
}));

interface ChipWithTooltipProps {
    item: Token;
    wallet: TokenWallet;
    conversionRate?: number;
    currencyLabel?: string;
    maxWidth?: string | number;
}

export const ChipWithTooltip: React.FC<ChipWithTooltipProps> = ({
    item,
    wallet,
    conversionRate = 1,
    currencyLabel = "$",
    maxWidth,
}) => {
    const fillPercentage = item.amount > 0 ? (wallet.amount / item.amount) * 100 : 0;
    // A wallet slice can be valued by a pool-implied price (FUEL) rather than
    // the token's direct provider quote. Prefer the server's canonical value.
    const convertedAmount = Number(wallet.usd_value ?? item.price * wallet.amount) * conversionRate;
    const tokenLabel = item.symbol || item.name;

    return (
        <Tooltip
            key={wallet.tag}
            title={`
                ${toFixedString(fillPercentage)}% /
                ${formatNumber(wallet.amount, "amount")} ${tokenLabel} /
                ${currencyLabel} ${formatNumber(convertedAmount, "axis")}
            `}
            placement="top"
        >
            <span style={{ display: "inline-flex", flex: "0 1 auto", minWidth: 0, maxWidth }}>
                <ColoredChip
                    label={wallet.tag}
                    variant="outlined"
                    size="small"
                    fillPercentage={fillPercentage}
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                        maxWidth: "100%",
                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                    }}
                />
            </span>
        </Tooltip>
    );
};
