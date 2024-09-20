import React, {useCallback, useMemo} from 'react';
import {
    Table,
    TableRow,
    TableCell,
    Avatar,
    Typography,
    Container,
    Card,
    TableHead,
    TableBody,
} from '@mui/material';
import { Box } from "@mui/system";
import chainList from '../../data/chain_list.json';
import { WalletList } from "../../interfaces/tokens";
import { Account } from "../../interfaces/account";
import {ChipWithTooltip} from "../utils/ChipWithTooltip";

type ChainId = string;
type ChainIdState = [ChainId, React.Dispatch<React.SetStateAction<ChainId>>];



const WalletTable: React.FC<{ data: Account, chainIdState: ChainIdState }> = ({ data, chainIdState }) => {
    const [selectedChainId] = chainIdState;
    const hideSmallBalances = 20


    const filterAndSortData = useCallback((data: WalletList) => {
        return data.filter(item => (item.amount * item.price) > hideSmallBalances && item.is_core && (selectedChainId === 'all' || item.chain === selectedChainId))
            .sort((a, b) => (b.price * b.amount) - (a.price * a.amount));
    }, [hideSmallBalances, selectedChainId]); // Add dependencies here


    const sortedData = useMemo(() => data.tokens ? filterAndSortData(data.tokens) : [], [data.tokens, filterAndSortData]);
    const totalUSD = useMemo(() => sortedData.reduce((acc, item) => acc + (item.price * item.amount), 0), [sortedData]);
    const getChainLogo = (chainId: string) => {
        const chain = chainList.chain_list.find(c => c.id === chainId);
        return chain ? chain.logo_url : '';
    };


    return (
        <Container>
            <Card sx={{ marginY: 10 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell component="th" scope="row" colSpan={6}>
                                <Typography variant="h6">Wallet</Typography>
                                <Typography variant="body2">$ {totalUSD.toFixed(2)}</Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedData.map((item) => (
                            <TableRow key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell sx={{ border: 0 }} component="th" scope="row">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Avatar alt={item.name} src={item.logo_url || ''} sx={{ width: 35, height: 35, marginRight: 1, backgroundColor: 'white' }} />
                                        <Box sx={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
                                            {item.chain && <Avatar alt={item.chain} src={getChainLogo(item.chain)} sx={{
                                                width: 20,
                                                height: 20,
                                                position: 'absolute',
                                                bottom: 0,
                                                right: 0,
                                                border: '1px solid',
                                                borderColor: 'background.paper'
                                            }}/>
                                            }                                        </Box>
                                        <Typography fontWeight="bold" marginLeft={2} variant="body2" noWrap>
                                            {item.name}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ border: 0 }} align="right">
                                    {item.wallets?.map((wallet) => <ChipWithTooltip key={wallet.id} item={item} wallet={wallet}/>)}
                                </TableCell>
                                <TableCell sx={{ border: 0, whiteSpace: 'nowrap' }} align="left">$ {item.price.toFixed(4)}</TableCell>
                                <TableCell sx={{ border: 0 }} align="right">{item.amount.toLocaleString()} {item.symbol}</TableCell>
                                <TableCell sx={{ border: 0, whiteSpace: 'nowrap', fontWeight: 'bold' }} align="right">$ {(item.amount * item.price).toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </Container>
    );
};

export default React.memo(WalletTable);
