import React from 'react';
import { Avatar, Typography, Container, Chip, Grid, Card, CardContent } from '@mui/material';
import { Box } from "@mui/system";
import { Account } from "../../interfaces/account";
import { SupplyTokenList } from '../../interfaces/protocol';

interface GroupedProtocols {
    [protocolName: string]: {
        name: string;
        positions: {
            type: string;
            chain: string;
            tokenName: string;
            logoUrl: string;
            price: number;
            amount: number;
            usdValue: number;
            wallets?: { tag: string }[]
        }[];
        totalUSD: number;
    };
}

type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];

const ProtocolTable: React.FC<{ data: Account, chainIdState: ChainIdState }> = ({data, chainIdState}) => {

    const [selectedChainId] = chainIdState;

    const groupedByProtocol: GroupedProtocols = data.protocols?.reduce<GroupedProtocols>((acc, protocol) => {
        if (!acc[protocol.name]) {
            acc[protocol.name] = {name: protocol.name, positions: [], totalUSD: 0};
        }

        const addPosition = (token: SupplyTokenList, itemName: string, walletTag: string | undefined) => {
            if ((selectedChainId === 'all' || token.chain === selectedChainId) && token.amount * token.price > 1) {
                const position = {
                    type: itemName,
                    chain: token.chain,
                    tokenName: token.name,
                    logoUrl: token.logo_url,
                    price: token.price,
                    amount: token.amount,
                    usdValue: token.amount * token.price,
                    wallets: walletTag ? [{ tag: walletTag }] : []
                };

                acc[protocol.name].positions.push(position);
                acc[protocol.name].totalUSD += position.usdValue;
            }
        };

        protocol.wallets?.forEach(wallet => {
            wallet.portfolio_items.forEach(item => {
                item.detail.supply_token_list?.forEach(token => {
                    addPosition(token, item.name, wallet.tag);
                });
            });
        });

        protocol.portfolio_item_list?.forEach(item => {
            item.detail.supply_token_list?.forEach(token => {
                addPosition(token, item.name, undefined);
            });
        });

        return acc;
    }, {}) || {};

    const sortedGroupedProtocols = Object.values(groupedByProtocol).sort((a, b) => b.totalUSD - a.totalUSD);

    return (
        <Container>
            {sortedGroupedProtocols.map(protocol => (
                protocol.totalUSD > 10 && (
                    <Card sx={{ marginY: 5 }} key={protocol.name}>
                        <CardContent sx={{ padding: 3 }}>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                                {protocol.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                $ {protocol.totalUSD.toFixed(2)}
                            </Typography>
                            <Grid container spacing={2}>
                                {protocol.positions.map((position, index) => (
                                    position.usdValue > 20 && (
                                        <Grid item xs={12} key={index}>
                                            <Box sx={{ marginTop: 3, marginBottom: 2 }}>
                                                <Chip sx={{ marginRight: 1 }} label={position.type} variant="filled" />
                                                {position.wallets?.map((wallet, i) => (
                                                    <Chip key={i} sx={{ marginRight: 1 }} label={wallet.tag} variant="outlined" size="small" />
                                                ))}
                                            </Box>
                                            <Grid container spacing={1}>
                                                <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar alt={position.tokenName} src={position.logoUrl} />
                                                    <Typography sx={{ marginLeft: 2 }}>{position.tokenName}</Typography>
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
                                    )
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                )
            ))}
        </Container>
    );
};

export default ProtocolTable;
