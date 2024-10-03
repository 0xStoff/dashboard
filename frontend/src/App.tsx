import React, {useEffect, useState} from 'react';
import {useFetchWallets} from './hooks/useFetchWallets';
import {fetchEvmAccounts} from './api/fetchEvmAccounts';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {
    AppBar,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    IconButton,
    ThemeProvider,
    Toolbar,
} from '@mui/material';
import {Settings} from '@mui/icons-material';
import {theme} from './utils/theme';
import {fetchSolanaData} from './api/fetchRaydiumSolanaTokens';
import {fetchCosmosTokens} from './api/fetchCosmosTokens';
import PieChartComponent from "./components/piechart/PieChart";
import SettingsDialog from "./components/settings/SettingsDialog";

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [hideSmallBalances, setHideSmallBalances] = useState<number>(10); // Default value
    const [openSettings, setOpenSettings] = useState(false);  // State for opening/closing settings popup

    const wallets = useFetchWallets();


    useEffect(() => {
        if (wallets.length > 0) {
            const fetchAccountsData = async () => {
                try {
                    setLoading(true);
                    const {updated, allChains, allTokens, allProtocols} = await fetchEvmAccounts(wallets);
                    const solData = await fetchSolanaData(wallets.filter(w => w.chain === 'sol'));
                    const cosmosData = await fetchCosmosTokens(wallets.filter(w => w.chain === 'cosmos'));

                    const chainsData = [...allChains, solData?.solMetadata, ...cosmosData?.chainMetadata || []].filter(chain => chain && chain.usd_value !== undefined); // Filter out any undefined or null chains

                    const totalUSDValue = chainsData.reduce((sum, chain) => sum + (chain.usd_value || 0), 0); // Check for usd_value

                    const allItem = {
                        id: 0,
                        tag: 'all',
                        wallet: '',
                        chains: {total_usd_value: totalUSDValue, chain_list: chainsData},
                        tokens: [...allTokens, ...(solData?.solTokens || []), ...(cosmosData?.mergedCosmos || [])],
                        protocols: allProtocols,
                    };

                    updated.push(solData?.sol);
                    updated.push(cosmosData?.cosmos);
                    setList([allItem, ...updated].filter(Boolean));
                    setSelectedItem(allItem);
                } catch (error) {
                    console.error('Error fetching account data:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchAccountsData();
        }
    }, [wallets]);


    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        <AppBar position="fixed" color="default">
            <Toolbar sx={{display: 'flex', overflowX: 'auto', '&::-webkit-scrollbar': {display: 'none'}}}>
                {list && list
                    .filter(Boolean)
                    .map((acc) => (<Chip
                        key={acc.id}
                        sx={{margin: 1}}
                        onClick={() => setSelectedItem(acc)}
                        label={acc.tag}
                        variant={selectedItem === acc ? "outlined" : "filled"}
                    />))}

                {/* Settings Icon */}
                <IconButton color="primary" onClick={() => setOpenSettings(true)}>
                    <Settings/>
                </IconButton>
            </Toolbar>
        </AppBar>
        <Container sx={{marginY: 15}}>
            {loading ? (<CircularProgress/>) : selectedItem ? (<>
                <PieChartComponent
                    chainIdState={chainIdState}
                    data={selectedItem}
                />
                <Container sx={{display: 'flex', marginTop: 10}}>
                    <ChainList
                        chainIdState={chainIdState}
                        data={selectedItem}
                        hideSmallBalances={hideSmallBalances}
                    />
                    <WalletTable
                        chainIdState={chainIdState}
                        data={selectedItem}
                        hideSmallBalances={hideSmallBalances}
                    />
                </Container>
                <ProtocolTable
                    chainIdState={chainIdState}
                    data={selectedItem}
                    hideSmallBalances={hideSmallBalances}
                />
            </>) : (<div>No data available</div>)}
        </Container>

        <SettingsDialog openSettings={openSettings} setOpenSettings={setOpenSettings}/>
    </ThemeProvider>);
}

export default App;