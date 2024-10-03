import React, {useEffect, useState} from 'react';
import {useFetchWallets} from './hooks/useFetchWallets';
import {fetchEvmAccounts} from './api/fetchEvmAccounts';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {
    AppBar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    CssBaseline,
    IconButton,
    ThemeProvider,
    Toolbar,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
} from '@mui/material';
import {Settings} from '@mui/icons-material';  // Settings icon
import {theme} from './utils/theme';
import {fetchSolanaData} from './api/fetchRaydiumSolanaTokens';
import {fetchCosmosTokens} from './api/fetchCosmosTokens';
import ThresholdSlider from "./utils/ThresholdSlider";
import PieChartComponent from "./components/piechart/PieChart";

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [hideSmallBalances, setHideSmallBalances] = useState<number>(10); // Default value
    const [openSettings, setOpenSettings] = useState(false);  // State for opening/closing settings popup
    const [nextClearTime, setNextClearTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<string>('');  // Timer for next cache clear

    const wallets = useFetchWallets();

    useEffect(() => {
        const storedHideSmallBalances = localStorage.getItem('hideSmallBalances');
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');
        const now = Date.now();

        if (storedHideSmallBalances) {
            setHideSmallBalances(JSON.parse(storedHideSmallBalances));
        }

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

    const handleSliderChange = (event: Event, newValue: number | number[]) => {
        localStorage.setItem('hideSmallBalances', JSON.stringify(newValue));
        setHideSmallBalances(newValue as number);
    };

    const handleOpenSettings = () => {
        setOpenSettings(true);
    };

    const handleCloseSettings = () => {
        setOpenSettings(false);
    };

    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        <AppBar position="fixed" color="default">
            <Toolbar sx={{display: 'flex', overflowX: 'auto', '&::-webkit-scrollbar': {display: 'none'}}}>
                {list && list
                    .filter(Boolean) // This removes any undefined or null items
                    .map((acc) => (<Chip
                        key={acc.id} // This will now only be called for valid `acc` objects
                        sx={{margin: 1}}
                        onClick={() => setSelectedItem(acc)}
                        label={acc.tag}
                        variant={selectedItem === acc ? "outlined" : "filled"}
                    />))}

                {/* Settings Icon */}
                <IconButton color="primary" onClick={handleOpenSettings}>
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
                <Container sx={{display: 'flex', justifyContent: 'space-around', marginTop: 10}}>
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

        <Dialog open={openSettings} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <ThresholdSlider
                    value={hideSmallBalances}
                    onChange={handleSliderChange}
                    min={0}
                    max={300}
                    label="Hide Small Balances"
                />
                <Button onClick={clearCache} disabled={!!countdown}>Clear Local Storage</Button>
                {countdown && (<Typography variant="body2" color="textSecondary">
                    Next clear available in: {countdown}
                </Typography>)}
            </DialogContent>
        </Dialog>
    </ThemeProvider>);
}

export default App;