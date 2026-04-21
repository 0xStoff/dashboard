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
}

export const ChipWithTooltip: React.FC<ChipWithTooltipProps> = ({ item, wallet }) => {
    const fillPercentage = item.amount > 0 ? (wallet.amount / item.amount) * 100 : 0;
    const dollarAmount = item.price * wallet.amount;
    const tokenLabel = item.symbol || item.name;

    return (
        <Tooltip
            key={wallet.tag}
            title={`
                ${toFixedString(fillPercentage)}% /
                ${formatNumber(wallet.amount, "amount")} ${tokenLabel} /
                ${toFixedString(dollarAmount)} $
            `}
            placement="top"
        >
            <span>
                <ColoredChip
                    label={wallet.tag}
                    variant="outlined"
                    size="small"
                    fillPercentage={fillPercentage}
                />
            </span>
        </Tooltip>
    );
};
