import React from "react";
import {Chip, ChipProps, Tooltip} from "@mui/material";
import {styled} from "@mui/system";
import { formatNumber, toFixedString } from "../../utils/number-utils";

interface ColoredChipProps extends ChipProps {
    label: string;
    fillPercentage: number;
}

export const ColoredChip = styled(({label, fillPercentage, ...other}: ColoredChipProps) => {
    const backgroundColor = 'transparent';
    const gradientColor = 'rgba(255, 255, 255, 0.16)';
    const gradient = `linear-gradient(90deg, ${gradientColor} ${fillPercentage}%, ${backgroundColor} ${fillPercentage}%)`;

    return (<Chip {...other} label={label} style={{background: gradient}}/>);
})<ColoredChipProps>(() => ({
    margin: 5,
}));


export const ChipWithTooltip: React.FC<{ item: any, wallet: any }> = ({item, wallet}) => {


    const fillPercentage = wallet.amount / item.amount * 100;
    const dollarAmount = item.price * wallet.amount;


    return (<Tooltip key={wallet.tag}
                     title={`
                     ${toFixedString(fillPercentage)}% / 
                     ${formatNumber(wallet.amount, 'amount')} ${item.symbol || item.tokenNames} / 
                     ${toFixedString(dollarAmount)} $ `}
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
    </Tooltip>)}