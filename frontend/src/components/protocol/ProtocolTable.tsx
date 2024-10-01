import React from 'react';
import { Avatar, Typography, Container, Grid, Card, CardContent, Chip } from '@mui/material';
import { Box } from "@mui/system";
import { Account } from "../../interfaces/account";
import { SupplyTokenList } from '../../interfaces/protocol';
import {ChipWithTooltip, ColoredChip} from '../utils/ChipWithTooltip';

interface GroupedProtocols {
    [protocolName: string]: {
        name: string;
        positions: Position[];
        totalUSD: number;
    };
}

interface Position {
    type: string;
    chain: string;
    tokenNames: string;
    logoUrls: string[];
    price: number;
    amount: number;
    usdValue: number;
    wallets: { tag: string; amount: number }[];
}

type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];

const ProtocolTable: React.FC<{ data: Account, chainIdState: ChainIdState, hideSmallBalances: number }> = ({ data, chainIdState, hideSmallBalances }) => {
    const [selectedChainId] = chainIdState;

    // Utility to add or update positions in a protocol
    const addPosition = (
        protocolName: string,
        acc: GroupedProtocols,
        tokens: SupplyTokenList[],
        itemName: string,
        walletTag: string | undefined,
        walletAmount: number | undefined
    ) => {

        // const validTokens = !walletTag  ? tokens.filter(token => token.amount * token.price > hideSmallBalances) :tokens.filter(token => token.amount * token.price > hideSmallBalances);
        const validTokens = tokens.filter(token => token.amount * token.price > 0);

        // console.log(validTokens)
        if (validTokens.length === 0) return;

        const tokenNames = validTokens.map(t => t.name).join(" + ");
        const logoUrls = validTokens.map(t => t.logo_url);
        const totalAmount = validTokens.reduce((sum, token) => sum + token.amount, 0);
        const totalUsdValue = validTokens.reduce((sum, token) => sum + token.amount * token.price, 0);
        const avgPrice = totalUsdValue / totalAmount;

        const protocol = acc[protocolName];
        const existingPositionIndex = protocol.positions.findIndex((p) => p.tokenNames === tokenNames && p.chain === validTokens[0].chain);

        if (existingPositionIndex > -1) {
            const existingPosition = protocol.positions[existingPositionIndex];
            if (walletTag && walletAmount) {
                existingPosition.wallets.push({ tag: walletTag, amount: walletAmount });
            }
        } else {
            protocol.positions.push({
                type: itemName,
                chain: validTokens[0].chain,
                tokenNames,
                logoUrls,
                price: avgPrice,
                amount: totalAmount,
                usdValue: totalUsdValue,
                wallets: walletTag ? [{ tag: walletTag, amount: walletAmount || 0 }] : []
            });
        }

        protocol.totalUSD += totalUsdValue;
    };

    // Main reduce function to group protocols by name and add positions
    const groupedByProtocol: GroupedProtocols = data.protocols?.reduce<GroupedProtocols>((acc, protocol) => {
        if (!acc[protocol.name]) {
            acc[protocol.name] = { name: protocol.name, positions: [], totalUSD: 0 };
        }

        if(protocol.wallets) {
            protocol.wallets?.forEach(wallet => {
                wallet.portfolio_items.forEach(item => {
                    const walletAmount = item.detail.supply_token_list?.[0]?.amount || 0;
                    addPosition(protocol.name, acc, item.detail.supply_token_list || [], item.name, wallet.tag, walletAmount);
                });
            });
        } else {
            protocol.portfolio_item_list.forEach(item => {
                const walletAmount = item.detail.supply_token_list?.[0]?.amount || 0;
                addPosition(protocol.name, acc, item.detail.supply_token_list || [], item.name, '', walletAmount);
            });
        }

        return acc;
    }, {}) || {};

    const sortedGroupedProtocols = Object.values(groupedByProtocol).sort((a, b) => b.totalUSD - a.totalUSD);

    // Rendering function for positions
    const renderPosition = (position: Position, index: number) => position.usdValue > hideSmallBalances && (
        <Grid item xs={12} key={index}>
            <Box sx={{ marginTop: 3, marginBottom: 2 }}>
                <Chip sx={{ marginRight: 1 }} label={position.type} variant="filled" />
                {position.wallets.map((wallet, i) => (
                    // <ChipWithÒTooltip key={i} item={position} wallet={wallet} />
                    <ColoredChip      label={wallet.tag}
                                      variant="outlined"
                                      size="small"
                                      fillPercentage='100'
                    />
                ))}
            </Box>
            <Grid container spacing={1}>
                <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
                    {position.logoUrls.map((url, i) => (
                        <Avatar key={i} alt={position.tokenNames} src={url} sx={{ marginRight: 1 }} />
                    ))}
                    <Typography sx={{ marginLeft: 2 }}>{position.tokenNames}</Typography>
                </Grid>
                <Grid item xs={2}>
                    <Typography>$ {position.price.toFixed(4)}</Typography>
                </Grid>
                <Grid item xs={2}>
                    <Typography>{position.amount.toFixed(5)}</Typography>
                </Grid>
                <Grid item xs={2}>
                    <Typography align='right' fontWeight="bold">$ {position.usdValue.toFixed(2)}</Typography>
                </Grid>
            </Grid>
        </Grid>
    );


    return (
        <Container>
            {sortedGroupedProtocols.map(protocol => (
                protocol.totalUSD > hideSmallBalances && (
                    <Card sx={{ marginY: 5 }} key={protocol.name}>
                        <CardContent sx={{ padding: 3 }}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                {protocol.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                $ {protocol.totalUSD.toFixed(2)}
                            </Typography>
                            <Grid container spacing={2}>
                                {protocol.positions.map(renderPosition)}
                            </Grid>
                        </CardContent>
                    </Card>
                )
            ))}
        </Container>
    );
};

export default ProtocolTable;

