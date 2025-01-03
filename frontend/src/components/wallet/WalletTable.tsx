import React, {useCallback, useMemo, useState} from 'react';
import {
    Table, TableRow, TableCell, Avatar, Typography, Container, Card, TableHead, TableBody,
} from '@mui/material';
import {Box} from "@mui/system";
import chainList from '../../data/chain_list.json';
import {WalletList} from "../../interfaces/tokens";
import {Account} from "../../interfaces/account";
import {ChipWithTooltip} from "../utils/ChipWithTooltip";
import {ChainIdState} from "../../interfaces/chain";


const WalletTable: React.FC<{ data: Account, chainIdState: ChainIdState }> = ({
                                                                                  data, chainIdState, hideSmallBalances
                                                                              }) => {
    const [selectedChainId] = chainIdState;


    const filterAndSortData = useCallback((data: WalletList) => {
        return data
            .filter(item => (item.amount * item.price) > hideSmallBalances && item.is_core && (selectedChainId === 'all' || item.chain === selectedChainId))
            .sort((a, b) => (b.price * b.amount) - (a.price * a.amount));
    }, [hideSmallBalances, selectedChainId]);

    const sortedData = useMemo(() => data.tokens ? filterAndSortData(data.tokens) : [], [data.tokens, filterAndSortData]);
    const totalUSD = useMemo(() => sortedData.reduce((acc, item) => acc + (item.price * item.amount), 0), [sortedData]);

    const getChainLogo = (chainId: string) => {
        const chain = chainList.chain_list.find(c => c.id === chainId);
        return chain ? chain.logo_url : '';
    };

    const widthClass = data.id ? 'max-content' : 'min-content'
    return (<Card sx={{height: 'fit-content', width: 'auto', borderRadius: 10}}>
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{border: 0, padding: 3}} component="th" scope="row" colSpan={6}>
                        <Typography variant="h5" fontWeight="bold">Wallet</Typography>
                        <Typography variant="body2" fontWeight="bold">$ {totalUSD.toFixed(2)}</Typography>
                    </TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {sortedData.map((item, index) => (
                    <TableRow key={item.id + index} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                        <TableCell sx={{border: 0}} component="th" scope="row">
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <Avatar alt={item.name} src={item.logo_url || ''}
                                        sx={{width: 35, height: 35, marginRight: 1, backgroundColor: 'white'}}/>
                                <Box sx={{position: 'relative', display: 'inline-flex', verticalAlign: 'middle'}}>
                                    {item.chain && <Avatar alt={item.chain} src={getChainLogo(item.chain)} sx={{
                                        width: 20,
                                        height: 20,
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        border: '1px solid',
                                        borderColor: 'background.paper'
                                    }}/>}
                                </Box>
                            </Box>
                        </TableCell>
                        <TableCell sx={{border: 0}} align="left">
                            <Typography fontWeight="bold" marginLeft={2} variant="body2" noWrap>
                                {/*{item.name.length > 20 ? item.symbol : item.name}*/}
                                {item.symbol}
                            </Typography>
                        </TableCell>
                        <TableCell sx={{border: 0}} align="right">
                            {item.wallets?.map((wallet) =>
                                <ChipWithTooltip
                                    key={wallet.id} item={item}
                                    wallet={wallet}/>)}
                        </TableCell>
                        <TableCell sx={{border: 0, whiteSpace: 'nowrap'}}
                                   align="left">$ {item.price.toFixed(4)}</TableCell>
                        <TableCell sx={{border: 0}}
                                   align="right">{item.amount.toLocaleString()} {item.symbol}</TableCell>
                        <TableCell sx={{border: 0, whiteSpace: 'nowrap', fontWeight: 'bold'}}
                                   align="right">$ {(item.amount * item.price).toFixed(2)}</TableCell>
                    </TableRow>))}
            </TableBody>
        </Table>
    </Card>);
};

export default React.memo(WalletTable);