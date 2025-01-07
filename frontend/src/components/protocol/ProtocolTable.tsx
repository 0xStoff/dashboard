import React from 'react';
import {
    Avatar, Typography, Container, Grid, Card, CardContent, Chip, TableCell, Table, TableHead, TableRow, TableBody
} from '@mui/material';
import {Box} from "@mui/system";
import {Account} from "../../interfaces/account";
import {GroupedProtocols, Position, SupplyTokenList} from '../../interfaces/protocol';
import {ChipWithTooltip, ColoredChip} from '../utils/ChipWithTooltip';
import {ChainIdState} from "../../interfaces/chain";


const ProtocolTable: React.FC<{ data: Account, chainIdState: ChainIdState, hideSmallBalances: number }> = ({
                                                                                                               data,
                                                                                                               chainIdState,
                                                                                                               hideSmallBalances
                                                                                                           }) => {
    const [selectedChainId] = chainIdState;

    const addPosition = (protocolName: string, acc: GroupedProtocols, tokens: SupplyTokenList[], itemName: string, walletTag: string | undefined, walletAmount: number | undefined) => {

        const validTokens = tokens.filter(token => token.amount * token.price > 0 && selectedChainId === 'all' || token.chain === selectedChainId);

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
                existingPosition.wallets.push({tag: walletTag, amount: walletAmount});
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
                wallets: walletTag ? [{tag: walletTag, amount: walletAmount || 0}] : []
            });
        }

        protocol.totalUSD += totalUsdValue;
    };

    // Main reduce function to group protocols by name and add positions
    const groupedByProtocol: GroupedProtocols = data.protocols?.reduce<GroupedProtocols>((acc, protocol) => {
        if (!acc[protocol.name]) {
            acc[protocol.name] = {name: protocol.name, positions: [], totalUSD: 0};
        }

        if (protocol.wallets) {
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
            <Box sx={{marginTop: 3, marginBottom: 2}}>
                <Chip sx={{marginRight: 1}} label={position.type} variant="filled"/>
                {position.wallets.map((wallet, i) => (// <ChipWithÒTooltip key={i} item={position} wallet={wallet} />
                    <ColoredChip label={wallet.tag}
                                 key={i}
                                 variant="outlined"
                                 size="small"
                                 fillPercentage='100'
                    />))}
            </Box>
            <Grid container spacing={1}>
                <Grid item xs={6} sx={{display: 'flex', alignItems: 'center'}}>
                    {position.logoUrls.map((url, i) => (
                        <Avatar key={i} alt={position.tokenNames} src={url} sx={{marginRight: 1}}/>))}
                    <Typography sx={{marginLeft: 2}}>{position.tokenNames}</Typography>
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
        </Grid>);


    const protocolViewSetting = true;

    return (protocolViewSetting ? <Container>
        <Card sx={{height: 'fit-content', width: 'auto', borderRadius: 10, marginTop: 10}}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{border: 0, padding: 3}} component="th" scope="row" colSpan={6}>
                            <Typography variant="h5" fontWeight="bold">Protocols</Typography>
                            <Typography variant="body2"
                                        fontWeight="bold">$ {sortedGroupedProtocols.reduce((total, protocol) => total + protocol.totalUSD, 0).toFixed(2)}</Typography>
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedGroupedProtocols
                        .filter(protocol => protocol.totalUSD > hideSmallBalances)
                        .map((protocol, i) => (
                            <React.Fragment key={protocol.name}>
                            {protocol.positions
                                .filter(position => position.usdValue > hideSmallBalances)
                                .map((position, index) => (<TableRow key={`${protocol.name}-${index}`}
                                                                     sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                                    <TableCell sx={{border: 0}} colSpan={6}>
                                        <Grid container spacing={1}>
                                            <Grid item xs={1} sx={{display: 'flex', alignItems: 'center'}}>
                                                {position.logoUrls.map((url, i) => (
                                                    <Avatar
                                                        key={i}
                                                        alt={position.tokenNames}
                                                        src={url}
                                                        sx={{marginRight: 1, width: 35, height: 35}}
                                                    />))}
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Typography>{position.tokenNames}</Typography>
                                                <Typography
                                                    variant='caption'>{protocol.name}</Typography>
                                            </Grid>

                                            <Grid item xs={2}>
                                                <Chip sx={{marginRight: 1}} label={position.type}
                                                      variant="filled"/>
                                                {position.wallets.map((wallet, i) => (<ColoredChip
                                                    label={wallet.tag}
                                                    key={i}
                                                    variant="outlined"
                                                    size="small"
                                                    fillPercentage="100"
                                                />))}
                                            </Grid>
                                            <Grid item xs={2}>
                                                <Typography>$ {position.price.toFixed(4)}</Typography>
                                            </Grid>
                                            <Grid item xs={2}>
                                                <Typography>{position.amount.toFixed(5)}</Typography>
                                            </Grid>
                                            <Grid item xs={2}>
                                                <Typography align="right"
                                                            fontWeight="bold">$ {position.usdValue.toFixed(2)}</Typography>
                                            </Grid>
                                        </Grid>
                                    </TableCell>
                                </TableRow>))}
                        </React.Fragment>))}
                </TableBody>
            </Table>
        </Card>
    </Container> : <Container>
        {sortedGroupedProtocols.map(protocol => (protocol.totalUSD > hideSmallBalances && (
            <Card sx={{marginY: 5, borderRadius: 10}} key={protocol.name}>
                <CardContent sx={{padding: 3}}>
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
            </Card>)))}
    </Container>);
};

export default ProtocolTable;

