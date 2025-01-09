import React, {useEffect, useState} from 'react';
import {useFetchWallets} from './hooks/useFetchWallets';
import {fetchEvmAccounts} from './api/fetchEvmAccounts';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {
    Box, Button, Card, Chip, CircularProgress, Container, CssBaseline, IconButton, ThemeProvider, Tooltip, Typography,
} from '@mui/material';
import {Settings} from '@mui/icons-material';
import {theme} from './utils/theme';
import {fetchSolanaData} from './api/fetchRaydiumSolanaTokens';
import {fetchCosmosTokens} from './api/fetchCosmosTokens';
import SettingsDialog from "./components/settings/SettingsDialog";
import Transactions from "./components/Transactions";
import {fetchAptosData, fetchStaticData, fetchSuiData} from "./api/fetchOtherTokens";
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'; // Money icon
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import RefreshIcon from '@mui/icons-material/Refresh';

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [hideSmallBalances, setHideSmallBalances] = useState<number>(10); // Default value
    const [openSettings, setOpenSettings] = useState(false);  // State for opening/closing settings popup
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


    const toggleView = () => {
        setIsCryptoView(!isCryptoView);
    };

    const clearCache1 = () => {
        localStorage.clear();
        window.location.reload();
    }

    const sortedData = selectedItem?.chains ? [...selectedItem.chains.chain_list].sort((a, b) => b.usd_value - a.usd_value) : [];

    const [nextClearTime, setNextClearTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<string>('');  // Timer for next cache clear


    useEffect(() => {
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');
        const now = Date.now();

        // Check if we need to show the countdown timer
        if (cacheClears.length > 0) {
            const lastClearTime = cacheClears[cacheClears.length - 1];
            const nextClear = lastClearTime + 8 * 60 * 60 * 1000;
            setNextClearTime(nextClear);

            // Start countdown timer
            if (nextClear > now) {
                const remainingTime = nextClear - now;
                setCountdown(formatTime(remainingTime));
                const timer = setInterval(() => {
                    const newRemainingTime = nextClear - Date.now();
                    if (newRemainingTime <= 0) {
                        clearInterval(timer);
                        setCountdown('');
                    } else {
                        setCountdown(formatTime(newRemainingTime));
                    }
                }, 1000);
                return () => clearInterval(timer);
            }
        }
    }, []);


    // Helper function to format the countdown time
    const formatTime = (time: number) => {
        const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((time / (1000 * 60)) % 60);
        const seconds = Math.floor((time / 1000) % 60);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const clearCache = () => {
        const now = Date.now();
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');

        // Filter out clears older than 24 hours
        const recentClears = cacheClears.filter((clearTime: number) => now - clearTime < 24 * 60 * 60 * 1000);

        // Check if we've cleared the cache more than 3 times in the last 24 hours or in the last 8 hours
        if (recentClears.length >= 3) {
            alert("Cache can only be cleared 3 times in 24 hours.");
            return;
        }

        if (recentClears.length > 0 && now - recentClears[recentClears.length - 1] < 8 * 60 * 60 * 1000) {
            alert("Cache can only be cleared once every 8 hours.");
            return;
        }

        // Clear the cache
        localStorage.clear();
        window.location.reload();

        // Add current timestamp to cacheClears
        recentClears.push(now);
        localStorage.setItem('cacheClears', JSON.stringify(recentClears));

        // Update nextClearTime
        const nextClear = now + 8 * 60 * 60 * 1000;
        setNextClearTime(nextClear);
        setCountdown(formatTime(nextClear - now));
    };


    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        {/*<NFTPortfolio walletAddress="0x770353615119F0f701118d3A4eaf1FE57fA00F84" />*/}
        <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
            <IconButton onClick={toggleView} color="primary" sx={{fontSize: '2rem'}}>
                {isCryptoView ? <CurrencyBitcoinIcon fontSize="large"/> : <MonetizationOnIcon fontSize="large"/>}
            </IconButton>
            <IconButton
                onClick={clearCache}
                color="primary"
                sx={{
                    fontSize: '2rem',
                    opacity: countdown ? 0.3 : 1,
                    pointerEvents: countdown ? 'none' : 'auto', // Prevent interaction if disabled
                }}
                disabled={!!countdown} // Adds semantic meaning
            >
                    <RefreshIcon fontSize="large" />
                <Typography variant='caption'>{countdown}</Typography>
            </IconButton>
        </Box>


        <Container sx={{marginY: 10}}>
            {loading ? (<CircularProgress/>) : selectedItem ? (<>
                {!isCryptoView && <Transactions/>}
                {isCryptoView && <Container sx={{display: 'flex'}}>
                    <Card sx={{padding: 3, width: '65%', borderRadius: 10, marginRight: 3}}>
                        <Typography variant="h5" fontWeight="bold">Net Worth</Typography>
                        <Typography fontWeight="bold" variant="h2">
                            $ {selectedItem?.chains && selectedChainId === 'all' ? selectedItem.chains.total_usd_value?.toLocaleString('de-CH', {
                            minimumFractionDigits: 2, maximumFractionDigits: 2
                        }) || '0.00' : sortedData.find((data) => data.id === selectedChainId)?.usd_value?.toLocaleString('de-CH', {
                            minimumFractionDigits: 2, maximumFractionDigits: 2
                        }) || '0.00'}
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

