import React from "react";
import {
    Avatar,
    Card,
    Table,
    TableCell,
    TableRow,
    Typography,
    TableHead,
    TableBody,
    Box,
} from "@mui/material";
import { ChainIdState, ChainListInterface } from "../../interfaces/chain";
import { Account } from "../../interfaces/account";

const ChainList: React.FC<{
    data: Account;
    chainIdState: ChainIdState;
    hideSmallBalances: number;
}> = ({ data, chainIdState, hideSmallBalances }) => {
    const [selectedChainId, setSelectedChainId] = chainIdState;

    const sortedData = data.chains?.chain_list
        ?.filter((chain) => chain.usd_value > hideSmallBalances)
        ?.sort((a, b) => b.usd_value - a.usd_value) || [];

    if (!sortedData.length) return null;

    const handleRowClick = (chain: ChainListInterface) => {
        setSelectedChainId(selectedChainId === chain.id ? "all" : chain.id);
    };

    const styles = {
        container: {
            flex: "0 0 auto",
            width: 200,
            maxWidth: 200,
        },
        card: {
            borderRadius: 10,
        },
        tableRow: (isActive: boolean) => ({
            cursor: "pointer",
            opacity: isActive ? 1 : 0.5,
            "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.08)" },
            "&:last-child td, &:last-child th": { border: 0 },
        }),
        tableCell: { border: 0 },
    };

    return (
        <Box sx={styles.container}>
            <Card sx={styles.card}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ border: 0, padding: 3 }} colSpan={6}>
                                <Typography variant="h5" fontWeight="bold">Chains</Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                </Table>
                <Box sx={{ height: 400, overflow: "auto", maxHeight: 'fit-content' }}>
                    <Table>
                        <TableBody>
                            {sortedData.map((chain) => (
                                <TableRow
                                    key={chain.id}
                                    hover
                                    onClick={() => handleRowClick(chain)}
                                    sx={styles.tableRow(
                                        selectedChainId === "all" || selectedChainId === chain.id
                                    )}
                                >
                                    <TableCell
                                        sx={{ display: "flex", alignItems: "center", ...styles.tableCell }}
                                    >
                                        <Avatar alt={chain.name} src={chain.logo_url} sx={{ width: 35, height: 35 }} />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: "bold", ...styles.tableCell }} align="right">
                                        $ {(+chain.usd_value.toFixed(2)).toLocaleString("de-CH")}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </Card>
        </Box>
    );
};

export default ChainList;