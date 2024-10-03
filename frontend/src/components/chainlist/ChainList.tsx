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
            <Card sx={{ width: 'fit-content', height: 'fit-content' }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell component="th" scope="row" colSpan={6}>
                                <Typography variant="h6">Chains</Typography>
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
                                    <Avatar alt={chain.name} src={chain.logo_url} sx={{ width: 35, height: 35, marginRight: 1 }} />
                                    <Typography>{chain.name}</Typography>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 'bold', border: 0 }} align='right'>
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