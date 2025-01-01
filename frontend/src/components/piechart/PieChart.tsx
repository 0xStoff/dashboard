import React, {useState} from 'react';
import {Container, Typography, Box, Card} from '@mui/material';
import {PieChart} from "@mui/x-charts";
import {ChainIdState, ChainListInterface} from "../../interfaces/chain";
import {Account} from "../../interfaces/account";


const PieChartComponent: React.FC<{ data: Account, chainIdState: ChainIdState }> = ({data, chainIdState}) => {

    const [selectedChainId, setSelectedChainId] = chainIdState;

    const sortedData = data.chains ? [...data.chains.chain_list].sort((a, b) => b.usd_value - a.usd_value) : [];

    const totalUSDValue = sortedData.reduce((sum, chain) => sum + chain.usd_value, 0);
    const significantThreshold = 0.025; // Threshold for what is considered significant
    const significantData = sortedData.filter(chain => (chain.usd_value / totalUSDValue) >= significantThreshold);
    const otherDataTotal = sortedData.filter(chain => (chain.usd_value / totalUSDValue) < significantThreshold).reduce((sum, chain) => sum + chain.usd_value, 0);

    const getArcLabel = (chain: Pick<ChainListInterface, "usd_value">) => {
        const percent = chain.usd_value / (data.chains ? data.chains.total_usd_value : 0);
        return `${(percent * 100).toFixed(2)} %`;
    };

    const pieChartData = [...significantData.map(chain => ({
        id: chain.id, value: chain.usd_value, label: `${chain.name} ${getArcLabel(chain)}`,
    })), ...(otherDataTotal > 0 ? [{
        id: 'other', value: otherDataTotal, label: `Other ${getArcLabel({usd_value: otherDataTotal})}`
    }] : [])];

    return (
        // <Container>
        <Card sx={{padding: 3, width: 'min-content', borderRadius: 10}}>
            <Typography variant="h5" fontWeight="bold">Net Worth</Typography>

            <Typography fontWeight='bold' variant="h2">
                $
                {data.chains && selectedChainId === 'all' ? data.chains.total_usd_value.toFixed(2) : sortedData.find(data => data.id === selectedChainId)?.usd_value.toFixed(2)}
            </Typography>
        </Card>

        // {/*<Box sx={{display: 'flex'}}>*/}
        // {/*    <PieChart*/}
        // {/*        series={[{*/}
        // {/*            data: pieChartData, innerRadius: 100, outerRadius: 160, paddingAngle: 3, cornerRadius: 3, cx: 30,*/}
        // {/*        }]}*/}
        // {/*        width={400}*/}
        // {/*        height={400}*/}
        // {/*    />*/}
        // {/*</Box>*/}
    // </Container>
);
};

export default PieChartComponent;


