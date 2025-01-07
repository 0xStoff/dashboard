import React, {useEffect, useState} from 'react';
import {useFetchWallets} from './hooks/useFetchWallets';
import {fetchEvmAccounts} from './api/fetchEvmAccounts';
import ChainList from './components/chainlist/ChainList';
import WalletTable from './components/wallet/WalletTable';
import ProtocolTable from './components/protocol/ProtocolTable';
import {Account} from './interfaces/account';
import {
    AppBar, Box, Card, Chip, CircularProgress, Container, CssBaseline, IconButton, ThemeProvider, Toolbar, Typography,
} from '@mui/material';
import {Settings} from '@mui/icons-material';
import {theme} from './utils/theme';
import {fetchSolanaData} from './api/fetchRaydiumSolanaTokens';
import {fetchCosmosTokens} from './api/fetchCosmosTokens';
import PieChartComponent from "./components/piechart/PieChart";
import SettingsDialog from "./components/settings/SettingsDialog";
import {getFullnodeUrl, SuiClient} from '@mysten/sui/client';
import {fetchTokenPrice} from "./api/fetchTokenPriceCoingecko";
import {Aptos, AptosConfig, Network} from "@aptos-labs/ts-sdk";
import ExchangesTable from "../archive/ExchangesTable";
import GnosisTransactionsTable from "../archive/GnosisTable";
import Transactions from "./components/Transactions";


function App() {
    const [selectedItem, setSelectedItem] = useState<Account | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>('all');
    const chainIdState = [selectedChainId, setSelectedChainId];
    const [list, setList] = useState<Account[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [hideSmallBalances, setHideSmallBalances] = useState<number>(10); // Default value
    const [openSettings, setOpenSettings] = useState(false);  // State for opening/closing settings popup

    const wallets = useFetchWallets();

    // Helper function to create token data
    const createTokenData = (id, name, symbol, decimals, logoUrl, price, amount, walletTag, walletId, walletAddress) => {
        return {
            id,
            name,
            symbol,
            decimals,
            logo_url: logoUrl,
            price: price || 0,
            amount: amount || 0,
            is_core: true,
            wallets: [{tag: walletTag, id: walletId, wallet: walletAddress, amount: amount || 0},],
        };
    };

    // Helper function to create chain data
    const createChainData = (chainId, chainList, tag, tokens, walletAddress) => {
        const totalUsdValue = tokens.reduce((sum, token) => sum + token.amount * token.price, 0);
        return {
            chains: {total_usd_value: totalUsdValue, chain_list: chainList},
            id: chainId,
            protocols: [],
            tag,
            tokens,
            wallet: walletAddress,
        };
    };

    useEffect(() => {
        if (wallets.length > 0) {
            const fetchAccountsData = async () => {
                try {
                    setLoading(true);
                    const {updated, allChains, allTokens, allProtocols} = await fetchEvmAccounts(wallets);
                    const solData = await fetchSolanaData(wallets.filter(w => w.chain === 'sol'));
                    const cosmosData = await fetchCosmosTokens(wallets.filter(w => w.chain === 'cosmos'));

                    const chainsData = [...allChains, solData?.solMetadata].filter(chain => chain && chain.usd_value !== undefined); // Filter out any undefined or null chains
                    // const chainsData = [...allChains, solData?.solMetadata || [], ...cosmosData?.chainMetadata || []].filter(chain => chain && chain.usd_value !== undefined);


                    // const totalUSDValue = [...chainsData].reduce((sum, chain) => sum + (chain.usd_value || 0), 0); // Check for usd_value
                    const totalUSDValue = [...chainsData, ...cosmosData?.chainMetadata].reduce((sum, chain) => sum + (chain.usd_value || 0), 0); // Check for usd_value


                    const rpcUrl = getFullnodeUrl('mainnet');

                    const client = new SuiClient({url: rpcUrl});
                    const suiAddress = "0xb0ff460367eae42bc92566dc50135dc12eed99ead8938d18f6b8c0dd0f41b11b";

                    const suiBalance = await client.getAllCoins({
                        owner: suiAddress,
                    });
                    const stakingData = await client.getStakes({
                        owner: suiAddress,
                    });


                    const tokenType = "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP";
                    const deepBalance = suiBalance.data.filter((coin) => coin.coinType === tokenType);


                    const suiPrice = await fetchTokenPrice('sui') || {usd: 0}
                    const deepPrice = await fetchTokenPrice('deep') || {usd: 0}

                    const suiAmount = stakingData[0].stakes[0].principal / 10 ** 9 + suiBalance.data[0].balance / 10 ** 9;
                    const deepAmount = deepBalance[0].balance / 10 ** 6
                    const mergedSui = [{
                        id: 'sui',
                        name: 'Sui',
                        symbol: 'SUI',
                        decimals: 18,
                        logo_url: "https://cryptologos.cc/logos/sui-sui-logo.png?v=035",
                        price: suiPrice.usd,
                        amount: suiAmount,
                        is_core: true,
                        wallets: [{tag: 'Sui', id: 30, wallet: suiAddress, amount: suiAmount}],
                    }, {
                        id: 'deep',
                        name: 'DEEP',
                        symbol: 'DEEP',
                        decimals: 18,
                        logo_url: "https://s2.coinmarketcap.com/static/img/coins/200x200/33391.png",
                        price: deepPrice.usd,
                        amount: deepAmount,
                        is_core: true,
                        wallets: [{tag: 'Sui', id: 30, wallet: suiAddress, amount: suiAmount}],
                    }];

                    const sui = {
                        chains: {
                            total_usd_value: suiAmount * suiPrice.usd + deepAmount * deepPrice.usd, chain_list: ['sui']
                        }, id: 30, protocols: [], tag: "Sui", tokens: mergedSui, wallet: suiAddress,
                    };

                    const config = new AptosConfig({network: Network.MAINNET});
                    const aptosConf = new Aptos(config);

                    const aptosAddress = "0x7acbb55470beae407d0c897c3d1c85ba5d17955cf48ce128a05a36c2e23e2260";

                    const stakingActivities = await aptosConf.staking.getDelegatedStakingActivities({
                        poolAddress: "0xdb5247f859ce63dbe8940cf8773be722a60dcc594a8be9aca4b76abceb251b8e",
                        delegatorAddress: aptosAddress
                    })

                    let totalStake = 0;
                    stakingActivities.forEach(activity => {
                        if (activity.event_type === "0x1::delegation_pool::AddStakeEvent") {
                            totalStake += activity.amount;
                        } else if (activity.event_type === "0x1::delegation_pool::UnlockStakeEvent") {
                            totalStake -= activity.amount;
                        }
                    });

                    const aptosBalance = await aptosConf.getAccountAPTAmount({accountAddress: aptosAddress});
                    const aptosPrice = await fetchTokenPrice('aptos') || {usd: 0}

                    const aptosAmount = totalStake / 10 ** 8 + aptosBalance / 10 ** 8;

                    const mergedAptos = [{
                        id: 'aptos',
                        name: 'Aptos',
                        symbol: 'APT',
                        decimals: 8,
                        logo_url: "https://cryptologos.cc/logos/aptos-apt-logo.png?v=035",
                        price: aptosPrice.usd,
                        amount: aptosAmount,
                        is_core: true,
                        wallets: [{tag: 'Aptos', id: 39, wallet: aptosAddress, amount: aptosAmount}],
                    }];

                    const aptos = {
                        chains: {total_usd_value: aptosAmount * aptosPrice.usd, chain_list: ['aptos']},
                        id: 30,
                        protocols: [],
                        tag: "Aptos",
                        tokens: mergedAptos,
                        wallet: aptosAddress,
                    };

                    const fetchDogecoinBalance = async (address) => {
                        const apis = [`https://api.blockcypher.com/v1/doge/main/addrs/${address}/balance`, // `https://sochain.com/api/v2/get_address_balance/DOGE/${address}`,
                            `https://dogechain.info/api/v1/address/balance/${address}`];

                        for (const api of apis) {
                            try {
                                const response = await fetch(api);
                                const data = await response.json();
                                break; // Exit loop if successful
                            } catch (error) {
                                console.error(`Error fetching from ${api}:`, error);
                            }
                        }
                    };

                    const dogeAddress = 'DRbbCDmZKR6p8xwx2926iM6BuPnxTS7reV';
                    const dogePrice = await fetchTokenPrice('dogecoin') || {usd: 0}
                    const dogeAmount = await fetchDogecoinBalance(dogeAddress) || 5000;

                    const mergedDoge = [{
                        id: 'doge',
                        name: 'Doge',
                        symbol: 'DOGE',
                        decimals: 16,
                        logo_url: "https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=045",
                        price: dogePrice.usd,
                        amount: dogeAmount,
                        is_core: true,
                        wallets: [{tag: 'Doge', id: 40, wallet: dogeAddress, amount: dogeAmount}],
                    }];

                    const doge = {
                        chains: {total_usd_value: dogeAmount * dogePrice.usd, chain_list: ['doge']},
                        id: 38,
                        protocols: [],
                        tag: "Doge",
                        tokens: mergedDoge,
                        wallet: dogeAddress,
                    };

                    const dotAddress = '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2';
                    const dotPrice = await fetchTokenPrice('polkadot') || {usd: 0}
                    const dotAmount = 100;

                    const mergedDot = [{
                        id: 'dot',
                        name: 'Polkadot',
                        symbol: 'DOT',
                        decimals: 16,
                        logo_url: "https://cryptologos.cc/logos/polkadot-new-dot-logo.png?v=035",
                        price: dotPrice.usd,
                        amount: dotAmount,
                        is_core: true,
                        wallets: [{tag: 'Dot', id: 43, wallet: dotAddress, amount: dotAmount}],
                    }];

                    const dot = {
                        chains: {total_usd_value: dotAmount * dotPrice.usd, chain_list: ['dot']},
                        id: 38,
                        protocols: [],
                        tag: "Doge",
                        tokens: mergedDot,
                        wallet: dotAddress,
                    };

                    const flowAddress = '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2';
                    const flowPrice = await fetchTokenPrice('flow') || {usd: 0}
                    const flowAmount = 700;

                    const mergedFlow = [{
                        id: 'flow',
                        name: 'Flow',
                        symbol: 'FLOW',
                        decimals: 16,
                        logo_url: "https://cryptologos.cc/logos/flow-flow-logo.png?v=040",
                        price: flowPrice.usd,
                        amount: flowAmount,
                        is_core: true,
                        wallets: [{tag: 'Flow', id: 43, wallet: flowAddress, amount: flowAmount}],
                    }];

                    const flow = {
                        chains: {total_usd_value: flowAmount * flowPrice.usd, chain_list: ['flow']},
                        id: 38,
                        protocols: [],
                        tag: "Flow",
                        tokens: mergedDot,
                        wallet: dotAddress,
                    };


                    const strkAddress = '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2';
                    const strkPrice = await fetchTokenPrice('starknet') || {usd: 0}
                    const strkAmount = 900;

                    const mergedStrk = [{
                        id: 'strk',
                        name: 'Starknet',
                        symbol: 'STRK',
                        decimals: 16,
                        logo_url: "https://cryptologos.cc/logos/starknet-token-strk-logo.png?v=040",
                        price: strkPrice.usd,
                        amount: strkAmount,
                        is_core: true,
                        wallets: [{tag: 'Strk', id: 43, wallet: strkAddress, amount: strkAmount}],
                    }];


                    const bvmAddress = '14MVcXjexqZTnqz4zSBhEbTzMdCL6mSVnVhsVMdKgx2Jvue2';
                    const bvmPrice = await fetchTokenPrice('bvm') || {usd: 0}
                    const bvmAmount = 1400;

                    const mergedBvm = [{
                        id: 'bvm',
                        name: 'BVM',
                        symbol: 'BVM',
                        decimals: 16,
                        logo_url: "https://cryptologos.cc/logos/bitcoin-plus-xbc-logo.png?v=040",
                        price: bvmPrice.usd,
                        amount: bvmAmount,
                        is_core: true,
                        wallets: [{tag: 'Bvm', id: 43, wallet: bvmAddress, amount: bvmAmount}],
                    }];


                    const allItem = {
                        id: 0,
                        tag: 'all',
                        wallet: '',
                        chains: {
                            total_usd_value: totalUSDValue + (suiAmount * mergedSui[0].price) + (deepAmount * mergedSui[1].price) + (aptosAmount * mergedAptos[0].price) + (dogeAmount * mergedDoge[0].price) + (dotAmount * mergedDot[0].price) + (flowAmount * mergedFlow[0].price) + (strkAmount * mergedStrk[0].price) + (bvmAmount * mergedBvm[0].price),
                            chain_list: chainsData
                        },
                        tokens: [...allTokens, ...(solData?.sol.tokens || []), ...(cosmosData?.mergedCosmos || []), ...mergedSui, ...mergedAptos, ...mergedDoge, ...mergedDot, ...mergedFlow, ...mergedStrk, ...mergedBvm],
                        protocols: allProtocols,
                    };

                    // updated.push(solData?.sol);
                    // updated.push(cosmosData?.cosmos);
                    // updated.push(sui)
                    // updated.push(aptos)

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
    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        <Container sx={{marginY: 10}}>
            {loading ? (<CircularProgress/>) : selectedItem ? (<>
                <Container sx={{display: 'flex'}}>
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
                </Container>
                {/*<PieChartComponent*/}
                {/*    chainIdState={chainIdState}*/}
                {/*    data={selectedItem}*/}
                {/*/>*/}
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
                <br/>
                <br/>
                <br/>

                <Transactions />

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

