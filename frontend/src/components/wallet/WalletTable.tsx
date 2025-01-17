import React, {useCallback, useMemo} from 'react';
import {
    Table, TableRow, TableCell, Avatar, Typography, Card, TableHead, TableBody,
} from '@mui/material';
import {Box} from "@mui/system";
import chainList from '../../data/chain_list.json';
import {WalletList} from "../../interfaces/tokens";
import {Account} from "../../interfaces/account";
import {ChipWithTooltip} from "../utils/ChipWithTooltip";
import {ChainIdState} from "../../interfaces/chain";

const WalletTable: React.FC<{
    data: Account, chainIdState: ChainIdState, height?: number, initialHeight?: number
}> = ({
          data, chainIdState, hideSmallBalances, height = 600, initialHeight = 0
      }) => {
    const [selectedChainId] = chainIdState;

    const filterAndSortData = useCallback((data: WalletList) =>
        data
            .filter(item => (item.amount * item.price) > hideSmallBalances && item.is_core && (selectedChainId === 'all' || item.chain === selectedChainId))
            .sort((a, b) => (b.price * b.amount) - (a.price * a.amount)), [hideSmallBalances, selectedChainId]);

    const sortedData = useMemo(() => data.tokens ? filterAndSortData(data.tokens) : [], [data.tokens, filterAndSortData]);
    const totalUSD = useMemo(() => sortedData.reduce((acc, item) => acc + (item.price * item.amount), 0), [sortedData]);

    if(!sortedData.length) return <></>

    const getChainLogo = (chainId: string) => {
        const chain = chainList.chain_list.find(c => c.id === chainId);
        return chain ? chain.logo_url : '';
    };



    return (<Card sx={{height: 'fit-content', width: 'auto', borderRadius: 10}}>
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{border: 0, padding: 3}} component="th" scope="row" colSpan={6}>
                        <Typography variant="h5" fontWeight="bold">Wallet</Typography>
                        <Typography variant="body2" fontWeight="bold">
                            $ {(+totalUSD.toFixed(2)).toLocaleString('de-CH')}
                        </Typography> </TableCell>
                </TableRow>
            </TableHead>
        </Table>
        <Box sx={{minHeight: `${initialHeight}px`, maxHeight: `${height}px`, overflow: 'auto'}}>
            <Table>
                <TableBody>
                    {sortedData.map((item, index) => (
                        <TableRow key={item.id + index} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                            <TableCell sx={{border: 0}} component="th" scope="row">
                                <Box sx={{display: 'flex', alignItems: 'center'}}>
                                    <Avatar alt={item.name} src={item.logo_url || ''}
                                            sx={{width: 35, height: 35, marginRight: 1, backgroundColor: 'white'}}/>
                                    <Box sx={{
                                        position: 'relative', display: 'inline-flex', verticalAlign: 'middle'
                                    }}>
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
                                    {item.symbol}
                                </Typography>
                            </TableCell>
                            <TableCell sx={{border: 0}} align="left">
                                {item.price_24h_change !== undefined && <Typography
                                    fontWeight="bold"
                                    marginLeft={2}
                                    variant="body2"
                                    noWrap
                                    sx={{
                                        color: item.price_24h_change >= 0 ? "success.main" : "error.main",
                                    }}
                                >
                                    {(item.price_24h_change * 100).toFixed(2)} %
                                </Typography>}
                            </TableCell>
                            <TableCell sx={{border: 0}} align="right">
                                {item.wallets?.map((wallet) => <ChipWithTooltip
                                    key={wallet.id} item={item}
                                    wallet={wallet}/>)}
                            </TableCell>
                            <TableCell sx={{border: 0, whiteSpace: 'nowrap'}} align="right">
                                $ {item.price >= 0.1 ? item.price.toFixed(2) : item.price.toFixed(6)}
                            </TableCell>
                            <TableCell sx={{border: 0}}
                                       align="right">{item.amount.toLocaleString("de-CH")} {item.symbol}</TableCell>
                            <TableCell sx={{border: 0, whiteSpace: 'nowrap', fontWeight: 'bold'}}
                                       align="right">$ {(item.amount * item.price).toFixed(2)}</TableCell>
                        </TableRow>))}
                </TableBody>
            </Table>
        </Box>
    </Card>);
};

export default React.memo(WalletTable);