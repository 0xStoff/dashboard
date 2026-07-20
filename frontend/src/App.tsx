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
import PortfolioInsights from "./components/crypto/PortfolioInsights";
import CapitalPerformance from "./components/crypto/CapitalPerformance";
import { TokenChart } from "./components/crypto/TokenChart";
import Header from "./components/header/Header";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useDashboardData } from "./hooks/useDashboardData";
import useDelay from "./hooks/useDelay";
import { Token } from "./interfaces";
import { appTheme } from "./styles/appTheme";

const DashboardApp: React.FC = () => {
    const [selectedWalletId, setSelectedWalletId] = useState<string>("all");
    const [selectedChainId, setSelectedChainId] = useState<string>("all");
    const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
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
    const {
        chains,
        loading: dashboardLoading,
        netWorth,
        protocolsTable,
        saveNetWorth,
        tokens,
        totalProtocolUSD,
        totalTokenUSD,
        totalUSDValue,
        wallets,
    } = useDashboardData({
        walletId: selectedWalletId,
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
            setSelectedWalletId("all");
            setIsBootstrapping(false);
            return;
        }

        if (!dashboardLoading) {
            setIsBootstrapping(false);
        }
    }, [dashboardLoading, isAuthenticated]);

    useEffect(() => {
        setSelectedToken(null);
    }, [searchQuery, selectedChainId, selectedWalletId]);

    useEffect(() => {
        if (!isAuthenticated || dashboardLoading) return;
        if (selectedWalletId !== "all" || selectedChainId !== "all" || searchQuery.trim()) return;

        void saveNetWorth(totalUSDValue, {
            wallets,
            chains,
            tokens,
            protocolsTable,
            totalProtocolUSD,
            totalTokenUSD,
        });
    }, [
        chains,
        dashboardLoading,
        isAuthenticated,
        protocolsTable,
        saveNetWorth,
        searchQuery,
        selectedChainId,
        selectedWalletId,
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

            {isBootstrapping || authStatus.loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                    <CircularProgress />
                </Box>
            ) : !isAuthenticated && delay ? (
                <Box sx={{ minHeight: "75vh", display: "grid", placeItems: "center", px: 3 }}>
                    <Box sx={{ textAlign: "center", maxWidth: 560 }}>
                        <Typography variant="overline" color="secondary.main" fontWeight={800} letterSpacing={2}>
                            YOUR FINANCIAL OVERVIEW
                        </Typography>
                        <Typography mt={1} variant="h3" fontWeight={750} letterSpacing="-.045em">
                            Everything you own, in one calm view.
                        </Typography>
                        <Typography mt={2} color="text.secondary">
                            Connect your wallet to see balances, positions, protocols and performance.
                        </Typography>
                    </Box>
                </Box>
            ) : (
                <Container maxWidth="xl" sx={{ marginY: { xs: 4, md: 7 }, px: { xs: 2, md: 4 } }}>
                    {!tokens.length && !protocolsTable.length && delay && <Typography>No data available</Typography>}

                    {(tokens.length > 0 || protocolsTable.length > 0 || chains.length > 0) && (
                        <>
                            {isCryptoView ? (
                                <>
                                    <Box position="relative">
                                        <Header
                                            currency={currency}
                                            totalUSDValue={totalUSDValue}
                                            selectedWalletId={selectedWalletId}
                                            setSelectedWalletId={setSelectedWalletId}
                                        />
                                        {!isMobile && (
                                            <IconButton
                                                aria-label={showChart ? "Hide net worth history" : "Show net worth history"}
                                                color="primary"
                                                onClick={() => setShowChart((previous) => !previous)}
                                                sx={{
                                                    position: "absolute",
                                                    top: 20,
                                                    right: 20,
                                                    bgcolor: "rgba(9,11,18,.5)",
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                }}
                                            >
                                                {showChart ? <SyncAlt fontSize="medium" /> : <BarChart fontSize="medium" />}
                                            </IconButton>
                                        )}
                                    </Box>

                                    {selectedWalletId === "all" &&
                                        !searchQuery.trim() &&
                                        chains.some((chain) => chain.chain_id === "hood") && (
                                        <CapitalPerformance
                                            currentValue={
                                                chains.find((chain) => chain.chain_id === "hood")?.usd_value || 0
                                            }
                                            netWorthHistory={netWorth}
                                        />
                                    )}

                                    <PortfolioInsights
                                        chains={chains}
                                        tokens={tokens}
                                        totalProtocolUSD={totalProtocolUSD}
                                        totalTokenUSD={totalTokenUSD}
                                        onSelectChain={setSelectedChainId}
                                        onSelectToken={setSelectedToken}
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
                                        maxWidth={false}
                                        disableGutters
                                        sx={{
                                            display: "flex",
                                            gap: 2.5,
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
