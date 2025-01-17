import React, {useEffect, useState} from 'react';
import {useFetchWallets} from './hooks/useFetchWallets';
import {fetchEvmAccounts} from './api/fetchEvmAccounts';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {
    Box,
    Card,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    IconButton,
    ThemeProvider,
    Typography,
} from '@mui/material';
import {Settings} from '@mui/icons-material';
import {theme} from './utils/theme';
import {fetchSolanaData} from './api/fetchRaydiumSolanaTokens';
import {fetchCosmosTokens} from './api/fetchCosmosTokens';
import SettingsDialog from "./components/settings/SettingsDialog";
import Transactions from "./components/Transactions";
import {fetchAptosData, fetchStaticData, fetchSuiData} from "./api/fetchOtherTokens";
import NavHeader from "./components/NavHeader";

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [hideSmallBalances, setHideSmallBalances] = useState<number>(10);
    const [openSettings, setOpenSettings] = useState(false);
    const [isCryptoView, setIsCryptoView] = useState(true);

    const wallets = useFetchWallets();


    useEffect(() => {
        if (wallets.length > 0) {
            const fetchAccountsData = async () => {
                try {
                    setLoading(true);
                    const {updated, allChains, allTokens, allProtocols} = await fetchEvmAccounts(wallets);
                    const solData = await fetchSolanaData(wallets.filter(w => w.chain === 'sol'));
                    const cosmosData = await fetchCosmosTokens(wallets.filter(w => w.chain === 'cosmos'));

                    const chainsData = [...allChains, solData?.solMetadata].filter(chain => chain && chain.usd_value !== undefined); // Filter out any undefined or null chains

                    const totalUSDValue = [...chainsData, ...cosmosData?.chainMetadata].reduce((sum, chain) => sum + (chain.usd_value || 0), 0); // Check for usd_value


                    const suiData = await fetchSuiData();
                    const aptosData = await fetchAptosData();


                    const staticData = await fetchStaticData();
                    const staticDatatotalUSDValue = staticData.reduce((sum, item) => {
                        return sum + (item.chains?.total_usd_value || 0);
                    }, 0);

                    const allTokenData = [...allTokens, ...(solData?.sol.tokens || []), ...(cosmosData?.mergedCosmos || []), ...suiData.tokens, ...aptosData.tokens, ...staticData.flatMap(data => data.tokens || [])]


                    const allItem = {
                        id: 0, tag: 'all', wallet: '', chains: {
                            total_usd_value: totalUSDValue + staticDatatotalUSDValue + suiData.chains.total_usd_value + aptosData.chains.total_usd_value,
                            chain_list: chainsData
                        }, tokens: allTokenData, protocols: allProtocols,
                    };

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





    const sortedData = selectedItem?.chains ? [...selectedItem.chains.chain_list].sort((a, b) => b.usd_value - a.usd_value) : [];


    const toFraction = (value: number | undefined): string => {
        if (value === undefined) {
            return '0.00'; // or handle it in a way that suits your needs
        }
        return value.toLocaleString('de-CH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        {/*<NFTPortfolio walletAddress="0x770353615119F0f701118d3A4eaf1FE57fA00F84" />*/}
        <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />

        <Container sx={{marginY: 10}}>
            {loading ? (<CircularProgress/>) : selectedItem ? (<>
                {!isCryptoView && <Transactions/>}
                {isCryptoView && <Container sx={{display: 'flex'}}>
                    <Card sx={{padding: 3, width: '65%', borderRadius: 10, marginRight: 3}}>
                        <Typography variant="h5" fontWeight="bold">Net Worth</Typography>
                        <Typography fontWeight="bold" variant="h2">
                            $ {selectedItem?.chains && selectedChainId === 'all' ?
                            toFraction(selectedItem.chains.total_usd_value) :
                            toFraction(sortedData.find((data) => data.id === selectedChainId)?.usd_value)}
                        </Typography>
                    </Card>
                    <Box>
                        {list && list
                            .filter(Boolean)
                            .map((acc, i) => (<Chip
                                key={`${acc.id}${i}`}
                                sx={{margin: 1}}
                                onClick={() => setSelectedItem(acc)}
                                label={acc.tag}
                                variant={selectedItem === acc ? "outlined" : "filled"}
                            />))}
                        <IconButton color="primary" onClick={() => setOpenSettings(true)}>
                            <Settings/>
                        </IconButton>
                    </Box>
                </Container>}
                {isCryptoView && <Container sx={{display: 'flex', marginTop: 10}}>
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
                </Container>}
                {isCryptoView && <ProtocolTable
                    chainIdState={chainIdState}
                    data={selectedItem}
                    hideSmallBalances={hideSmallBalances}
                />}
            </>) : (<div>No data available</div>)}
        </Container>
        <SettingsDialog
            hideSmallBalances={hideSmallBalances}
            setHideSmallBalances={setHideSmallBalances}
            openSettings={openSettings}
            setOpenSettings={setOpenSettings}
        />
    </ThemeProvider>);
}

export default App;

