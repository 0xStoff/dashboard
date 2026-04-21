import React, { useEffect, useRef, useState } from "react";
import { BarChart, SyncAlt } from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    Container,
    IconButton,
    Typography,
    useMediaQuery,
} from "@mui/material";
import {
    ChainList,
    NavHeader,
    ProtocolTable,
    Transactions,
    WalletTable,
} from "./components";
import AppProviders from "./app/AppProviders";
import { NetWorthChart } from "./components/crypto/NetWorthChart";
import { TokenChart } from "./components/crypto/TokenChart";
import Header from "./components/header/Header";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useDashboardData } from "./hooks/useDashboardData";
import useDelay from "./hooks/useDelay";
import { DashboardSelection, Token } from "./interfaces";
import { appTheme } from "./styles/appTheme";

const DashboardApp: React.FC = () => {
    const [selectedItem, setSelectedItem] = useState<DashboardSelection | null>(null);
    const [selectedChainId, setSelectedChainId] = useState<string>("all");
    const [loading, setLoading] = useState<boolean>(true);
    const [isCryptoView, setIsCryptoView] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showChart, setShowChart] = useState<boolean>(false);
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [currency, setCurrency] = useState<"CHF" | "$">("$");

    const isMobile = useMediaQuery(appTheme.breakpoints.down("sm"));
    const delay = useDelay(2000);
    const tokenChartRef = useRef<HTMLDivElement | null>(null);

    const authStatus = useAuthStatus();
    const walletId = selectedItem?.id || "all";
    const {
        chains,
        loading: dashboardLoading,
        netWorth,
        protocolsTable,
        saveNetWorth,
        selectedData,
        tokens,
        totalProtocolUSD,
        totalTokenUSD,
        totalUSDValue,
        wallets,
    } = useDashboardData({
        walletId,
        selectedChainId,
        searchQuery,
    });

    useEffect(() => {
        if (!authStatus.loading) {
            setIsAuthenticated(authStatus.isAuthenticated);
        }
    }, [authStatus.isAuthenticated, authStatus.loading]);

    useEffect(() => {
        if (selectedToken && tokenChartRef.current && "scrollIntoView" in tokenChartRef.current) {
            tokenChartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [selectedToken]);

    useEffect(() => {
        if (!isAuthenticated) {
            setSelectedItem(null);
            setLoading(false);
            return;
        }

        if (!dashboardLoading) {
            setLoading(true);
            setSelectedItem(selectedData);
            saveNetWorth(totalUSDValue, {
                wallets,
                chains,
                tokens,
                protocolsTable,
                totalProtocolUSD,
                totalTokenUSD,
            }).finally(() => setLoading(false));
        }
    }, [
        chains,
        dashboardLoading,
        isAuthenticated,
        protocolsTable,
        saveNetWorth,
        selectedData,
        tokens,
        totalProtocolUSD,
        totalTokenUSD,
        totalUSDValue,
        wallets,
    ]);

    return (
        <>
            <NavHeader
                currency={currency}
                setCurrency={setCurrency}
                isAuthenticated={Boolean(isAuthenticated)}
                isCryptoView={isCryptoView}
                setIsCryptoView={setIsCryptoView}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setIsAuthenticated={setIsAuthenticated}
            />

            {loading || authStatus.loading ? (
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
                                                {showChart ? (
                                                    <SyncAlt fontSize="medium" />
                                                ) : (
                                                    <BarChart fontSize="medium" />
                                                )}
                                            </IconButton>
                                        </Box>
                                    )}
                                    <Header
                                        currency={currency}
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

                                    <Container
                                        sx={{
                                            display: "flex",
                                            gap: 3,
                                            marginY: 3,
                                            flexDirection: { xs: "column", md: "row" },
                                        }}
                                    >
                                        <ChainList
                                            chains={chains}
                                            chainIdState={[selectedChainId, setSelectedChainId]}
                                        />
                                        <WalletTable
                                            tokens={tokens}
                                            chainList={chains}
                                            selectedToken={selectedToken}
                                            setSelectedToken={setSelectedToken}
                                        />
                                    </Container>
                                    <ProtocolTable
                                        selectedToken={selectedToken}
                                        protocols={protocolsTable}
                                        setSelectedToken={setSelectedToken}
                                    />
                                </>
                            ) : (
                                <Transactions />
                            )}
                        </>
                    )}
                </Container>
            )}
        </>
    );
};

const App: React.FC = () => (
    <AppProviders>
        <DashboardApp />
    </AppProviders>
);

export default App;
