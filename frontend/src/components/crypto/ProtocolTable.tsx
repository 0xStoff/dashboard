import React from 'react';
import {
    Avatar, Typography, Container, Grid, Card, CardContent, Chip, TableCell, Table, TableHead, TableRow, TableBody
} from '@mui/material';
import {Box} from "@mui/system";
import {Account} from "../../interfaces/account";
import {GroupedProtocols, Position, SupplyTokenList} from '../../interfaces/protocol';
import {ChipWithTooltip, ColoredChip} from '../utils/ChipWithTooltip';
import {ChainIdState} from "../../interfaces/chain";


const ProtocolTable: React.FC<{
    data: Account;
    chainIdState: ChainIdState;
    hideSmallBalances: number;
}> = ({ data, chainIdState, hideSmallBalances }) => {
    const [selectedChainId] = chainIdState;

    const addPosition = (
        protocolName: string,
        acc: GroupedProtocols,
        tokens: SupplyTokenList[],
        itemName: string,
        walletTag: string | undefined,
        walletAmount: number | undefined
    ) => {
        const validTokens = tokens.filter(
            (token) =>
                token.amount * token.price > hideSmallBalances &&
                (selectedChainId === 'all' || token.chain === selectedChainId)
        );

        if (!validTokens.length) return;

        const tokenNames = validTokens.map((t) => t.name).join(' + ');
        const logoUrls = validTokens.map((t) => t.logo_url);
        const totalAmount = validTokens.reduce((sum, token) => sum + token.amount, 0);
        const totalUsdValue = validTokens.reduce((sum, token) => sum + token.amount * token.price, 0);
        const avgPrice = totalUsdValue / totalAmount;

        const protocol = acc[protocolName];
        const existingPositionIndex = protocol.positions.findIndex(
            (p) => p.tokenNames === tokenNames && p.chain === validTokens[0].chain && p.type === itemName
        );

        if (existingPositionIndex > -1) {
            const existingPosition = protocol.positions[existingPositionIndex];
            if (walletTag && walletAmount !== undefined) {
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
                wallets: walletTag && walletAmount !== undefined ? [{ tag: walletTag, amount: walletAmount }] : [],
            });
        }

        protocol.totalUSD += totalUsdValue;
    };

    const groupedByProtocol: GroupedProtocols =
        data.protocols?.reduce<GroupedProtocols>((acc, protocol) => {
            if (!acc[protocol.name]) {
                acc[protocol.name] = { name: protocol.name, positions: [], totalUSD: 0 };
            }

            const addWalletPositions = (item: any, walletTag: string) => {
                const walletAmount = item.detail.supply_token_list?.[0]?.amount || 0;
                addPosition(
                    protocol.name,
                    acc,
                    item.detail.supply_token_list || [],
                    item.name,
                    walletTag,
                    walletAmount
                );
            };


            protocol.wallets
                ? protocol.wallets.forEach((wallet) =>
                    wallet.portfolio_item_list.forEach((item) => addWalletPositions(item, wallet.tag))
                )
                : protocol.portfolio_item_list.forEach((item) => addWalletPositions(item, ''));

            return acc;
        }, {}) || {};

    const unifyPositions = (positions: Position[]): Position[] => {
        const unified: { [key: string]: Position } = {};

        positions.forEach((position) => {
            const key = `${position.tokenNames}-${position.type}-${position.chain}`;
            if (unified[key]) {
                unified[key].amount += position.amount;
                unified[key].usdValue += position.usdValue;
                unified[key].wallets = [...unified[key].wallets, ...position.wallets];
            } else {
                unified[key] = { ...position, wallets: [...position.wallets] };
            }
        });

        return Object.values(unified).sort((a, b) => b.usdValue - a.usdValue); // Sort by USD value
    };

    const sortedGroupedProtocols = Object.values(groupedByProtocol)
        .map((protocol) => ({
            ...protocol,
            positions: unifyPositions(protocol.positions), // Unify positions here
        }))
        .sort((a, b) => b.totalUSD - a.totalUSD)
        .filter((protocol) => protocol.totalUSD > hideSmallBalances);

    if (!sortedGroupedProtocols.length) return null;

    // console.log(sortedGroupedProtocols)

    return <Container>
            {sortedGroupedProtocols.map((protocol) => (
                protocol.totalUSD > hideSmallBalances && (
                    <Card sx={{ marginY: 5, borderRadius: 10 }} key={protocol.name}>
                        <CardContent sx={{ padding: 3 }}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                {protocol.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                $ {protocol.totalUSD.toFixed(2)}
                            </Typography>
                            {protocol.positions.map((position, index) =>
                                position.usdValue > hideSmallBalances && (
                                    <Grid key={index} container marginTop={2}>
                                        <Grid sx={{ display: 'flex' }} item xs={1}>
                                            {position.logoUrls.map((url, i) => (
                                                <Avatar key={i} alt={position.tokenNames} src={url} sx={{ marginRight: 1 }} />
                                            ))}
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Typography sx={{ marginLeft: 2 }}>{position.tokenNames}</Typography>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Typography>$ {position.price.toFixed(2)}</Typography>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Chip label={position.type} variant="filled" />
                                            {position.wallets.map((wallet, i) => (
                                                <ColoredChip
                                                    key={i}
                                                    label={wallet.tag}
                                                    variant="outlined"
                                                    size="small"
                                                    fillPercentage="100"
                                                />
                                            ))}
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Typography align="right">{position.amount.toFixed(5)}</Typography>
                                        </Grid>
                                        <Grid item xs={2}>
                                            <Typography align="right" fontWeight="bold">
                                                $ {position.usdValue.toFixed(2)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                )
                            )}
                        </CardContent>
                    </Card>
                )
            ))}
        </Container>
};

export default ProtocolTable;

