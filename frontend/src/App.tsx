import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    ChainList,
    NavHeader,
    ProtocolTable,
    Transactions,
    WalletTable
} from "./components";
import {
    Box,
    CircularProgress,
    Container,
    CssBaseline,
    IconButton,
    Typography,
    useMediaQuery
} from "@mui/material";
import { ThemeProvider } from "@mui/system";
import { useFetchWallets } from "./hooks/useFetchWallets";
import { useFetchChains } from "./hooks/useFetchChains";
import { useFetchTokens } from "./hooks/useFetchTokens";
import { useFetchProtocolsTable } from "./hooks/useFetchProtocolsTable";
import { theme } from "./utils/theme";
import { NetWorthChart } from "./components/crypto/NetWorthChart";
import { useFetchNetWorth } from "./hooks/useFetchNetWorth";
import Header from "./components/header/Header";
import { Chain, Protocol, Token } from "./interfaces";
import { BarChart, SyncAlt } from "@mui/icons-material";
import { TokenChart } from "./components/crypto/TokenChart";
import {WalletsProvider} from "./context/WalletsContext";

interface SelectedItem {
    id: string;
    tag: string;
    chains: {
        total_usd_value: number;
        chain_list: Chain[];
    };
    tokens: Token[];
    protocolsTable: Protocol[];
}

export const useDelay = (delay: number) => {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // if (condition) {
            const timeout = setTimeout(() => {
                setShouldRender(true);
            }, delay);
            return () => clearTimeout(timeout);
        // } else {
        //     setShouldRender(false);
        // }
    }, [delay]);

    return shouldRender;
};

const App: React.FC = () => {
    const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>("all");
    const [loading, setLoading] = useState<boolean>(true);
    const [isCryptoView, setIsCryptoView] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showChart, setShowChart] = useState<boolean>(false);
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [currency, setCurrency] = useState<'CHF' | '$'>('CHF');


    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const walletId: string = selectedItem?.id || "all";

    const { netWorth, loading: netWorthLoading, saveNetWorth } = useFetchNetWorth({latest: false, includeDetails: true});
    const { wallets, loading: walletsLoading, fetchWallets, setWallets } = useFetchWallets();
    const { chains, loading: chainsLoading } = useFetchChains(walletId, searchQuery);
    const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens({
        chain: selectedChainId,
        walletId,
        searchQuery,
    });
    const { protocolsTable, totalProtocolUSD, loading: protocolsTableLoading } =
        useFetchProtocolsTable(selectedChainId, walletId, searchQuery);

    const totalUSDValue: number = totalTokenUSD + totalProtocolUSD;

    const fetchAccountsData = useCallback(async () => {
        if (walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading) return;

        setLoading(true);
        try {
            const selectedData = {
                id: "all",
                tag: "all",
                chains: { total_usd_value: totalUSDValue, chain_list: chains },
                tokens,
                protocolsTable,
            };

            setSelectedItem(selectedData);

            await saveNetWorth(totalUSDValue, {
                wallets,
                chains,
                tokens,
                protocolsTable,
                totalProtocolUSD,
                totalTokenUSD,
            });

        } catch (error) {
            console.error("Error fetching account data:", error);
        } finally {
            setLoading(false);
        }
    }, [totalUSDValue, chains, tokens, protocolsTable]);



    useEffect(() => {
        if (!isAuthenticated) {
            setSelectedItem(null);
            setLoading(false);
            return;
        }

        if (!walletsLoading && !chainsLoading && !tokensLoading && !protocolsTableLoading) {
            fetchAccountsData();
        }
    }, [walletsLoading, chainsLoading, tokensLoading, protocolsTableLoading, isAuthenticated]);

    useEffect(() => {
        const checkAuthentication = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/auth/check`, {
                    credentials: "include",
                });

                const data = await response.json();
                if (data.success) {
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Error checking authentication:", error);
                setIsAuthenticated(false);
            }
        };

        checkAuthentication();
    }, []);



    const tokenChartRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (selectedToken && tokenChartRef.current) {
            if ("scrollIntoView" in tokenChartRef.current) {
                tokenChartRef.current.scrollIntoView({behavior: "smooth", block: "start"});
            }
        }
    }, [selectedToken]);

    const delay = useDelay(2000);


    return (
        <WalletsProvider>
        <ThemeProvider theme={theme}>
            <CssBaseline />

            <NavHeader
                currency={currency}
                setCurrency={setCurrency}
                isAuthenticated={isAuthenticated}
                isCryptoView={isCryptoView}
                setIsCryptoView={setIsCryptoView}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setIsAuthenticated={setIsAuthenticated}
            />

            {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                    <CircularProgress />
                </Box>
            ) : !isAuthenticated && delay ? (
                <Typography margin={20} variant="h4">
                    Connect your Wallet to see the dashboard
                </Typography>
            ) : (
                <Container sx={{ marginY: 10 }}>
                    {!selectedItem && delay && <Typography>No data available</Typography>}

                    {selectedItem && (
                        <>
                            {isCryptoView ? (
                                <>
                                    {!isMobile && (
                                        <Box display="flex" justifyContent="flex-end" mb={2}>
                                            <IconButton
                                                color="primary"
                                                onClick={() => setShowChart((prev) => !prev)}
                                            >
                                                {showChart ? <SyncAlt fontSize="medium" /> : <BarChart fontSize="medium" />}
                                            </IconButton>
                                        </Box>
                                    )}
                                    <Header
                                        currency={currency}
                                        wallets={wallets}
                                        totalUSDValue={totalUSDValue}
                                        selectedItemState={[selectedItem, setSelectedItem]}
                                    />
                                    {showChart && <NetWorthChart setShowChart={setShowChart} data={netWorth} />}

                                    {selectedToken && (
                                        <div ref={tokenChartRef}>
                                            <TokenChart
                                                netWorthHistory={netWorth}
                                                selectedToken={selectedToken}
                                                setSelectedToken={setSelectedToken}
                                            />
                                        </div>
                                    )}

                                    <Container sx={{
                                        display: "flex",
                                        gap: 3,
                                        marginY: 3,
                                        flexDirection: { xs: "column", md: "row" },
                                    }}>
                                        <ChainList chains={chains} chainIdState={[selectedChainId, setSelectedChainId]} />
                                        <WalletTable tokens={tokens} chainList={chains} selectedToken={selectedToken} setSelectedToken={setSelectedToken} />
                                    </Container>
                                    <ProtocolTable selectedToken={selectedToken} protocols={protocolsTable} setSelectedToken={setSelectedToken} />
                                </>
                            ) : (
                                <Transactions />
                            )}
                        </>
                    )}
                </Container>
            )}
        </ThemeProvider>
            </WalletsProvider>
            );
};

export default App;