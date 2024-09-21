import React, {useEffect, useState} from 'react';
import {AppBar, Button, Chip, Container, CssBaseline, ThemeProvider, Toolbar} from '@mui/material';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {mergeAndAggregateChains, mergeAndAggregateTokens, mergeProtocols} from './utils/data-transform';
import {fetchAllAccountsData, fetchNode} from "./api/fetch";
import {theme} from "./utils/theme";
import {fetchWallets} from "./api/apiService";
import {fetchSolanaData} from "./api/fetchRaydiumSolanaTokens";
import {fetchCosmosTokens} from "./api/fetchCosmosTokens";

type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState: ChainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [wallets, setWallets] = useState([]);

    useEffect(() => {
        const loadWallets = async () => {
            try {
                const walletsData = await fetchWallets();
                setWallets(walletsData);
            } catch (error) {
                console.error('Failed to load wallets:', error);
            }
        };

        loadWallets();
    }, []);

    useEffect(() => {
        if (wallets.length > 0) {
            const fetchEvmAccounts = async () => {
                try {
                    // Fetch EVM accounts
                    const updated = await fetchAllAccountsData(wallets.filter(wallet => wallet.chain === 'evm'));
                    const allChains = mergeAndAggregateChains(updated);
                    const allTokens = mergeAndAggregateTokens(updated);
                    const allProtocols = mergeProtocols(updated);

                    const {solMetadata, solTokens, sol} = await fetchSolanaData();
                    const {chainMetadata, mergedCosmos, cosmos} = await fetchCosmosTokens()

                    const chainsData = [...allChains, solMetadata, ...chainMetadata];
                    const totalUSDValue = chainsData.reduce((sum, chain) => sum + chain.usd_value, 0);

                    // Create all-in-one item
                    const allItem = {
                        id: 0,
                        tag: 'all',
                        wallet: '',
                        chains: {total_usd_value: totalUSDValue, chain_list: chainsData},
                        tokens: [...allTokens, ...solTokens, ...mergedCosmos],
                        protocols: allProtocols,
                    };


                    updated.push(sol);
                    updated.push(cosmos);
                    setList([allItem, ...updated]);
                    setSelectedItem(allItem);
                } catch (error) {
                    console.error("Failed to fetch account data:", error);
                }
            };

            fetchEvmAccounts();
        }
    }, [wallets]);


    return (<ThemeProvider theme={theme}>
            <CssBaseline/>
            <AppBar position="fixed" color="default">
                <Toolbar sx={{display: 'flex', overflowX: 'auto', '&::-webkit-scrollbar': {display: 'none'}}}>
                    {list && list.map((acc) => (<Chip
                            key={acc.id}
                            sx={{margin: 1}}
                            onClick={() => setSelectedItem(acc)}
                            label={acc.tag}
                            variant={selectedItem === acc ? "outlined" : "filled"}
                        />))}
                    <Button onClick={() => {
                        localStorage.clear();
                        window.location.reload();
                    }}>clear local storage</Button>
                </Toolbar>
            </AppBar>
            <Container sx={{marginY: 15}}>
                {selectedItem ? (<>
                        <ChainList chainIdState={chainIdState} data={selectedItem}/>
                        <WalletTable chainIdState={chainIdState} data={selectedItem}/>
                        <ProtocolTable chainIdState={chainIdState} data={selectedItem}/>
                    </>) : (<div>Loading...</div>)}
            </Container>
        </ThemeProvider>);
}

export default App;