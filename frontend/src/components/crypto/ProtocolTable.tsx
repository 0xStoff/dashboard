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
    hideSmallBalances: number;
    protocols: any;
}> = ({   hideSmallBalances, protocols }) => {

    if (!protocols.length) return null;


    return <Container>
            {protocols.map((protocol) => (
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

