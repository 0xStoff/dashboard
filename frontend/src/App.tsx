import React, {useEffect, useState} from 'react';
import {AppBar, Button, Chip, Container, CssBaseline, ThemeProvider, Toolbar} from '@mui/material';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {mergeAndAggregateChains, mergeAndAggregateTokens, mergeProtocols} from './utils/data-transform';
import {fetchAllAccountsData, fetchNode} from "./api/fetch";
import {theme} from "./utils/theme";
import wallets from './data/wallets.json';
import {fetchRaydiumData} from "./api/fetchRaydiumSolanaTokens";
import {chains} from "./interfaces/cosmos";


type ChainIdState = [string, React.Dispatch<React.SetStateAction<string>>];

function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState: ChainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);


    useEffect(() => {
        const fetchAccount = async ()  => {
            try {
                const updated = await fetchAllAccountsData(wallets);
                const allChains = mergeAndAggregateChains(updated);
                const allTokens = mergeAndAggregateTokens(updated);
                const allProtocols = mergeProtocols(updated);

                const solanaTokens = await fetchRaydiumData();
                const solTotalValue = calculateTotalValue(solanaTokens, 'usd');

                const result = await fetchNode();

                const chainMetadata = chains.map(chain => {
                    const {totalValue, amount, price} = aggregateChainData(chain.name, result); // Aggregate the value for the current chain
                    return {
                        ...chain, // Use the chain's logo and symbol directly
                        usd_value: totalValue,
                        usd: price,
                        amount,
                        address: chain.wallets[0], // Assuming the first wallet for the metadata
                    };
                });

                const solMetadata = {
                    id: 'sol',
                    name: 'Solana',
                    logo_url: "https://zapper.xyz/cdn-cgi/image/width=64/https://storage.googleapis.com/zapper-fi-assets/tokens/solana/So11111111111111111111111111111111111111111.png",
                    usd_value: solTotalValue,
                    address: 'BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq',
                    symbol: 'SOL',
                    decimals: 9
                };

                const mergedSolana = solanaTokens.map(t => ({
                    id: t.address,
                    chain: "sol",
                    name: t.name,
                    symbol: t.symbol,
                    decimals: t.decimals,
                    logo_url: t.logoURI,
                    price: t.usd,
                    amount: t.amount,
                    is_core: true,
                    wallets: [{ tag: "Sol", id: 15, wallet: t.address, amount: t.amount }],
                }));

                const mergedCosmos = chainMetadata.map((t,i) => ({
                    id: t.id,
                    // chain: t.id,
                    name: t.name,
                    symbol: t.symbol,
                    decimals: t.decimals,
                    logo_url: t.logo_url,
                    price: t.usd,
                    amount: t.amount,
                    is_core: true,
                    wallets: [{ tag: t.symbol, id: i + 16, wallet: t.address, amount: t.amount }],
                }));


                const chainsData = [...allChains, solMetadata, ...chainMetadata];
                const totalUSDValue = chainsData.reduce((sum, chain) => sum + chain.usd_value, 0);

                const allItem = {
                    id: 0,
                    tag: 'all',
                    wallet: '',
                    chains: { total_usd_value: totalUSDValue, chain_list: chainsData },
                    tokens: [...allTokens, ...mergedSolana, ...mergedCosmos],
                    protocols: allProtocols,
                };

                const sol = {
                    chains: { total_usd_value: solTotalValue, chain_list: [solMetadata] },
                    id: 15,
                    protocols: [],
                    tag: "Sol",
                    tokens: mergedSolana,
                    wallet: "BnEzyR69UfNAaSi45KB5rkXjXekE7ErHEnVWNgYqFPzq",
                };

                const cosmos = {
                    chains: { total_usd_value: solTotalValue, chain_list: [chainMetadata] },
                    id: 16,
                    protocols: [],
                    tag: "Cosmos",
                    tokens: mergedCosmos,
                    wallet: "cosmos1kdjwfc8rhjd744qvmza6qzv3d5k9wzudsnzhuc",
                };

                updated.push(sol);
                updated.push(cosmos)
                setList([allItem, ...updated]);
                setSelectedItem(allItem);
            } catch (error) {
                console.error("Failed to fetch account data:", error);
            }
        };

        const calculateTotalValue = (items: any[], priceField: string) => {
            return items.reduce((sum, item) => {
                const price = priceField.split('.').reduce((o, i) => o?.[i], item); // Dynamic access to nested fields
                return sum + (item.amount * (price || 0)); // Ensure price is valid
            }, 0);
        };

        const aggregateChainData = (chainName: string, result: any[]) => {
            const filteredData = result.filter(r => r.chain === chainName);
            const allData = filteredData.flatMap(r => r.data);
            return { totalValue: calculateTotalValue(allData, 'price.usd'), amount:  allData.reduce((sum, item) => (sum + item.amount),0), price: allData[0].price.usd }
        };

        fetchAccount();
    }, []);



    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        <AppBar position="fixed" color="default">
            <Toolbar sx={{display: 'flex', overflowX: 'auto', '&::-webkit-scrollbar': {display: 'none'}}}>
                {list && list.sort((a, b) => a.id - b.id).map((acc) => (<Chip
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
