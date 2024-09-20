import React from 'react';
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
    Box
} from '@mui/material';
import {PieChart} from "@mui/x-charts";
import {ChainListInterface} from "../../interfaces/chain";
import {Account} from "../../interfaces/account";

type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];

const ChainList: React.FC<{ data: Account, chainIdState: ChainIdState }> = ({data, chainIdState}) => {
    const [selectedChainId, setSelectedChainId] = chainIdState;

    const handleRowClick = (chain: ChainListInterface) => {
        setSelectedChainId(selectedChainId === chain.id ? 'all' : chain.id);
    };


    const sortedData = data.chains ? [...data.chains.chain_list].sort((a, b) => b.usd_value - a.usd_value) : [];
    const hideSmallBalances = 10

    // Calculate significant and other data for Pie Chart
    const totalUSDValue = sortedData.reduce((sum, chain) => sum + chain.usd_value, 0);
    const significantThreshold = 0.025; // Threshold for what is considered significant
    const significantData = sortedData
        .filter(chain => (chain.usd_value / totalUSDValue) >= significantThreshold);
    const otherDataTotal = sortedData
        .filter(chain => (chain.usd_value / totalUSDValue) < significantThreshold)
        .reduce((sum, chain) => sum + chain.usd_value, 0);


    const getArcLabel = (chain: Pick<ChainListInterface, "usd_value">) => {
        const percent = chain.usd_value / (data.chains ? data.chains.total_usd_value : 0);
        return `${(percent * 100).toFixed(2)} %`;
    };


    const pieChartData = [...significantData.map(chain => ({
        id: chain.id, value: chain.usd_value, label: `${chain.name} ${getArcLabel(chain)}`,
    })), ...(otherDataTotal > 0 ? [{
        id: 'other',
        value: otherDataTotal,
        label: `Other ${getArcLabel({usd_value: otherDataTotal})}`
    }] : [])];


    return (<Container>
            <Typography fontWeight='bold' variant="h2">
                $
                {data.chains && selectedChainId === 'all' ? data.chains.total_usd_value.toFixed(2) : sortedData.filter(data => data.id === selectedChainId)[0]?.usd_value.toFixed(2)}
            </Typography>
            <Box sx={{display: 'flex'}}>
                <PieChart
                    series={[{
                        data: pieChartData,
                        innerRadius: 100,
                        outerRadius: 160,
                        paddingAngle: 3,
                        cornerRadius: 3,
                        cx: 30,
                    }]}
                    width={400}
                    height={400}
                />
            </Box>
            <Card sx={{flex: 1, margin: 2, height: 'fit-content'}}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell component="th" scope="row" colSpan={6}>
                                <Typography variant="h6">Chains</Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedData.map((chain) => chain.usd_value > hideSmallBalances && (<TableRow
                                key={chain.id}
                                hover
                                onClick={() => handleRowClick(chain)}
                                sx={{
                                    cursor: 'pointer',
                                    opacity: selectedChainId === 'all' || selectedChainId === chain.id ? 1 : 0.5,
                                    '&:hover': {backgroundColor: 'rgba(0, 0, 0, 0.08)'},
                                    '&:last-child td, &:last-child th': {border: 0},
                                }}
                            >
                                <TableCell sx={{display: 'flex', alignItems: 'center', border: 0}}>
                                    <Avatar alt={chain.name} src={chain.logo_url}
                                            sx={{width: 35, height: 35, marginRight: 1}}/>
                                    <Typography>{chain.name}</Typography>
                                </TableCell>
                                <TableCell sx={{fontWeight: 'bold', border: 0}} align='right'>
                                    $ {chain.usd_value.toFixed(2)}
                                </TableCell>
                            </TableRow>))}
                    </TableBody>
                </Table>
            </Card>
        </Container>);
};

export default ChainList;
