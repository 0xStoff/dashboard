import React, {useEffect, useState} from "react";
import {
    Box, Card, Chip, CircularProgress, Container, CssBaseline, IconButton, ThemeProvider, Typography,
} from "@mui/material";
import {Settings} from "@mui/icons-material";
import {theme} from "./utils/theme";
import {useFetchWallets} from "./hooks/useFetchWallets";
import {
    fetchEvmAccounts, fetchSolanaData, fetchCosmosTokens, fetchAptosData, fetchSuiData, fetchStaticData,
} from "./api";
import {
    ChainList, WalletTable, ProtocolTable, SettingsDialog, Transactions, NavHeader,
} from "./components";

function App() {
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedChainId, setSelectedChainId] = useState("all");
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hideSmallBalances, setHideSmallBalances] = useState(10);
    const [openSettings, setOpenSettings] = useState(false);
    const [isCryptoView, setIsCryptoView] = useState(true);

    const wallets = useFetchWallets();

    const fetchAccountsData = async () => {
        if (!wallets.length) return;

        try {
            setLoading(true);

            const [evmData, solData, cosmosData, suiData, aptosData, staticData,] = await Promise.all([fetchEvmAccounts(wallets), fetchSolanaData(wallets.filter((w) => w.chain === "sol")), fetchCosmosTokens(wallets.filter((w) => w.chain === "cosmos")), fetchSuiData(), fetchAptosData(), fetchStaticData(),]);


            const totalUSDValue = [
                ...evmData.allChains,
                solData?.solMetadata,
                ...cosmosData?.chainMetadata,
                suiData.chains,
                aptosData.chains,
                ...staticData.map((data) => data.chains),
            ]
                .filter(Boolean)
                .reduce((sum, chain) => sum + (chain?.usd_value || chain?.total_usd_value || 0), 0);

            const allTokens = [
                ...evmData.allTokens,
                ...(solData?.sol.tokens || []),
                ...(cosmosData?.mergedCosmos || []),
                ...suiData.tokens,
                ...aptosData.tokens,
                ...staticData.flatMap((data) => data.tokens || [])
            ];


            const unifiedCosmosList = cosmosData.chainMetadata.reduce((acc, item) => {
                acc.usd_value += item.usd_value;
                acc.addresses.push(item.address);
                acc.symbols.push(item.symbol);
                return acc;
            }, {
                id: "cosmos",
                name: "Cosmos",
                chain: 'cosmos',
                logo_url: cosmosData.chainMetadata[3]?.logo_url || "",
                usd_value: 0,
                addresses: [],
                symbols: []
            });


            const allItem = {
                id: 0,
                tag: "all",
                chains: {total_usd_value: totalUSDValue, chain_list: [...evmData.allChains, solData?.solMetadata, unifiedCosmosList]},
                tokens: allTokens,
                protocols: evmData.allProtocols,
            };

            const safeItems = evmData.updated.filter((item) => item.tag === "Safe");

            const unifiedSafeItem = safeItems.reduce(
                (acc, item, index) => {
                    acc.chains.total_usd_value += item.chains.total_usd_value || 0;
                    acc.tokens.push(...(item.tokens || []));
                    acc.protocols.push(...(item.protocols || []));

                    if (index === 0 && item.chains.chain_list) {
                        acc.chains.chain_list = item.chains.chain_list.map((chain) => {
                            const totalChainUSD = safeItems.reduce((sum, safeItem) => {
                                const matchingChain = safeItem.chains.chain_list.find((c) => c.id === chain.id);
                                return sum + (matchingChain?.usd_value || 0);
                            }, 0);
                            return { ...chain, usd_value: totalChainUSD };
                        });
                    }

                    return acc;
                },
                {
                    id: "safe",
                    tag: "Safe",
                    chains: { total_usd_value: 0, chain_list: [] },
                    tokens: [],
                    protocols: [],
                }
            );

            setList([allItem, unifiedSafeItem, ...evmData.updated.filter((item) => item.tag !== "Safe")]);

            setSelectedItem(allItem);


        } catch (error) {
            console.error("Error fetching account data:", error);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchAccountsData();
    }, [wallets]);

    const formatUSD = (value) => value?.toLocaleString("de-CH", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }) || "0.00";

    return (<ThemeProvider theme={theme}>
        <CssBaseline/>
        <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView}/>

        <Container sx={{marginY: 10}}>
            {loading ? (<CircularProgress/>) : selectedItem ? (<>
                {!isCryptoView && <Transactions/>}
                {isCryptoView && (<Container sx={{display: "flex"}}>
                    <Card sx={{padding: 3, width: "65%", borderRadius: 10, marginRight: 3}}>
                        <Typography variant="h5" fontWeight="bold">Net Worth</Typography>
                        <Typography variant="h2" fontWeight="bold">
                            $ {formatUSD(selectedChainId === "all" ? selectedItem.chains.total_usd_value : selectedItem.chains.chain_list.find((c) => c.id === selectedChainId)?.usd_value)}
                        </Typography>
                    </Card>
                    <Box>
                        {list.map((acc, i) => (
                            <Chip
                            key={`${acc.id}-${i}`}
                            sx={{margin: 1}}
                            onClick={() => setSelectedItem(acc)}
                            label={acc.tag}
                            variant={selectedItem === acc ? "outlined" : "filled"}
                        />))}
                        <IconButton color="primary" onClick={() => setOpenSettings(true)}>
                            <Settings/>
                        </IconButton>
                    </Box>
                </Container>)}
                {isCryptoView && (<>
                    <Container sx={{display: 'flex', gap: 3, marginY: 3}}>
                        <ChainList
                            chainIdState={[selectedChainId, setSelectedChainId]}
                            data={selectedItem}
                            hideSmallBalances={hideSmallBalances}
                        />

                        <WalletTable
                            chainIdState={[selectedChainId, setSelectedChainId]}
                            data={selectedItem}
                            hideSmallBalances={hideSmallBalances}
                        />
                    </Container>

                    <ProtocolTable
                        chainIdState={[selectedChainId, setSelectedChainId]}
                        data={selectedItem}
                        hideSmallBalances={hideSmallBalances}
                    />
                </>)}
            </>) : (<Typography>No data available</Typography>)}
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