import React, { useState } from 'react';
import {
    Avatar,
    Card,
    Container,
    Table,
    TableCell,
    TableRow,
    Typography,
    TableHead,
    TableBody,
    Box,
} from '@mui/material';
import { PieChart } from "@mui/x-charts";
import {ChainIdState, ChainListInterface} from "../../interfaces/chain";
import { Account } from "../../interfaces/account";


const ChainList: React.FC<{ data: Account, chainIdState: ChainIdState, hideSmallBalances }> = ({ data, chainIdState, hideSmallBalances }) => {
    const [selectedChainId, setSelectedChainId] = chainIdState;



    const handleRowClick = (chain: ChainListInterface) => {
        setSelectedChainId(selectedChainId === chain.id ? 'all' : chain.id);
    };

    const sortedData = data.chains ? [...data.chains.chain_list].sort((a, b) => b.usd_value - a.usd_value) : [];


    return (
            <Card sx={{ minWidth: 200, height: 'fit-content', marginRight: 5, borderRadius: 10 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{border: 0, padding: 3}} component="th" scope="row" colSpan={6}>
                                <Typography variant="h5" fontWeight="bold">Chains</Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {/* Filter out small chains based on slider value */}
                        {sortedData.map((chain) => chain.usd_value > hideSmallBalances && (
                            <TableRow
                                key={chain.id}
                                hover
                                onClick={() => handleRowClick(chain)}
                                sx={{
                                    cursor: 'pointer',
                                    opacity: selectedChainId === 'all' || selectedChainId === chain.id ? 1 : 0.5,
                                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.08)' },
                                    '&:last-child td, &:last-child th': { border: 0 },
                                }}
                            >
                                <TableCell sx={{ display: 'flex', alignItems: 'center', border: 0 }}>
                                    <Avatar alt={chain.name} src={chain.logo_url} sx={{ width: 35, height: 35}} />
                                    {/*<Typography>{chain.name}</Typography>*/}
                                </TableCell>
                                <TableCell sx={{ border: 0, fontWeight: 'bold' }} align='right'>
                                    $ {chain.usd_value.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
    );
};

export default ChainList;