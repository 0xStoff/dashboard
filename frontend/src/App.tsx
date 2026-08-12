import React, { useEffect, useState } from "react";
import {
    Box,
    CircularProgress,
    Container,
    Dialog,
    DialogContent,
    Typography,
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
import RobinhoodPerformance from "./components/crypto/RobinhoodPerformance";
import PoolRadar from "./components/crypto/PoolRadar";
import { TokenChart } from "./components/crypto/TokenChart";
import Header from "./components/header/Header";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useDashboardData } from "./hooks/useDashboardData";
import useDelay from "./hooks/useDelay";
import { useUsdToChfRate } from "./hooks/useUsdToChfRate";
import { Token } from "./interfaces";
import { useDashboardSettings } from "./context/DashboardSettingsContext";
import { useWallets } from "./context/WalletsContext";

const DashboardApp: React.FC = () => {
    const [selectedWalletId, setSelectedWalletId] = useState<string>("all");
    const [selectedChainId, setSelectedChainId] = useState<string>("all");
    const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
    const [isCryptoView, setIsCryptoView] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [showChart, setShowChart] = useState<boolean>(false);
    const [showRobinhoodDashboard, setShowRobinhoodDashboard] = useState<boolean>(false);
    const [showPoolRadar, setShowPoolRadar] = useState<boolean>(() => new URLSearchParams(window.location.search).get("view") === "pool-radar");
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const { settings, updateSettings, reload: reloadSettings } = useDashboardSettings();
    const { fetchWallets } = useWallets();
    const currency = settings.defaultCurrency;
    const setCurrency: React.Dispatch<React.SetStateAction<"CHF" | "$">> = (value) => {
        const next = typeof value === "function" ? value(currency) : value;
        void updateSettings({ defaultCurrency: next });
    };

    const delay = useDelay(2000);

    const authStatus = useAuthStatus();
    const { rate: usdToChfRate } = useUsdToChfRate();
    const conversionRate = currency === "CHF" && usdToChfRate !== null ? usdToChfRate : 1;
    const currencyLabel = currency === "CHF" ? "CHF" : "$";
    const {
        chains,
        hiddenAssetTokens,
        loading: dashboardLoading,
        netWorth,
        protocolsTable,
        tokens,
        totalProtocolUSD,
        totalTokenUSD,
        totalUSDValue,
        portfolioSnapshot,
    } = useDashboardData({
        walletId: selectedWalletId,
        selectedChainId,
        searchQuery,
        enabled: Boolean(isAuthenticated),
    });

    useEffect(() => {
        if (!authStatus.loading) {
            setIsAuthenticated(authStatus.isAuthenticated);
        }
    }, [authStatus.isAuthenticated, authStatus.loading]);

    useEffect(() => {
        if (!isAuthenticated) return;
        void fetchWallets();
        void reloadSettings();
    }, [fetchWallets, isAuthenticated, reloadSettings]);

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
                showRobinhoodDashboard={showRobinhoodDashboard}
                setShowRobinhoodDashboard={setShowRobinhoodDashboard}
                showPoolRadar={showPoolRadar}
                setShowPoolRadar={setShowPoolRadar}
            />

            {(!showRobinhoodDashboard && !showPoolRadar && isBootstrapping) || authStatus.loading || (!showRobinhoodDashboard && !showPoolRadar && Boolean(isAuthenticated) && dashboardLoading && totalUSDValue <= 0) ? (
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
                            Connect your wallet to see balances, positions, protocols and history.
                        </Typography>
                    </Box>
                </Box>
            ) : (
                <Container
                    maxWidth="xl"
                    sx={{
                        marginY: { xs: 2, md: 3.5 },
                        px: { xs: 2, sm: 3, lg: 4 },
                        overflowX: "clip",
                    }}
                >
                    {!dashboardLoading && totalUSDValue <= 0 && delay && <Typography>No data available</Typography>}

                    {showPoolRadar ? (
                        <PoolRadar />
                    ) : showRobinhoodDashboard ? (
                        <RobinhoodPerformance />
                    ) : (totalUSDValue > 0 || chains.length > 0) && (
                        <>
                            {isCryptoView ? (
                                <>
                                    <Header
                                        assetCount={tokens.length}
                                        currency={currency}
                                        history={
                                            selectedWalletId === "all" &&
                                            selectedChainId === "all" &&
                                            !searchQuery.trim()
                                                ? netWorth
                                                : []
                                        }
                                        isFiltered={
                                            selectedWalletId !== "all" ||
                                            selectedChainId !== "all" ||
                                            Boolean(searchQuery.trim())
                                        }
                                        networkCount={chains.length}
                                        onToggleHistory={() => setShowChart((previous) => !previous)}
                                        protocolCount={protocolsTable.length}
                                        selectedWalletId={selectedWalletId}
                                        setSelectedWalletId={setSelectedWalletId}
                                        showHistory={showChart}
                                        totalProtocolUSD={totalProtocolUSD}
                                        totalTokenUSD={totalTokenUSD}
                                        totalUSDValue={totalUSDValue}
                                    />

                                    {portfolioSnapshot.dataHealth.warnings.map((warning) => (
                                        <Box
                                            key={warning}
                                            sx={{
                                                mt: 1.25,
                                                px: 1.5,
                                                py: 1,
                                                borderRadius: 2,
                                                bgcolor: "rgba(245, 158, 11, 0.08)",
                                                border: "1px solid rgba(245, 158, 11, 0.22)",
                                            }}
                                        >
                                            <Typography variant="caption" color="warning.main" fontWeight={700}>
                                                {warning}
                                            </Typography>
                                        </Box>
                                    ))}

                                    {showChart && selectedWalletId === "all" && selectedChainId === "all" && !searchQuery.trim() && (
                                        <NetWorthChart
                                            currentNetWorth={totalUSDValue}
                                            conversionRate={conversionRate}
                                            currencyLabel={currencyLabel}
                                            data={netWorth}
                                            setShowChart={setShowChart}
                                        />
                                    )}

                                    <ChainList
                                        chains={chains}
                                        chainIdState={[selectedChainId, setSelectedChainId]}
                                        conversionRate={conversionRate}
                                        currencyLabel={currencyLabel}
                                    />
                                    <Box
                                        sx={{
                                            display: "grid",
                                            width: "100%",
                                            minWidth: 0,
                                            gridTemplateColumns: "minmax(0, 1fr)",
                                            alignItems: "start",
                                            gap: { xs: 2, lg: 2.5 },
                                        }}
                                    >
                                        <WalletTable
                                            hiddenTokens={hiddenAssetTokens}
                                            tokens={tokens}
                                            chainList={chains}
                                            conversionRate={conversionRate}
                                            currencyLabel={currencyLabel}
                                            expanded={!protocolsTable.length}
                                            portfolioTotalUSD={totalTokenUSD}
                                            selectedToken={selectedToken}
                                            setSelectedToken={setSelectedToken}
                                        />
                                        <ProtocolTable
                                            conversionRate={conversionRate}
                                            currencyLabel={currencyLabel}
                                            protocols={protocolsTable}
                                            portfolioTotalUSD={totalProtocolUSD}
                                            selectedToken={selectedToken}
                                            setSelectedToken={setSelectedToken}
                                        />
                                    </Box>

                                    <Dialog
                                        open={Boolean(selectedToken)}
                                        onClose={() => setSelectedToken(null)}
                                        fullWidth
                                        maxWidth="md"
                                        aria-labelledby="asset-history-title"
                                        PaperProps={{
                                            sx: {
                                                m: { xs: 1.5, sm: 3 },
                                                width: { xs: "calc(100% - 24px)", sm: "calc(100% - 48px)" },
                                                maxHeight: "calc(100% - 24px)",
                                                overflow: "hidden",
                                            },
                                        }}
                                    >
                                        <DialogContent sx={{ p: 0 }}>
                                            {selectedToken && (
                                                <TokenChart
                                                    conversionRate={conversionRate}
                                                    currencyLabel={currencyLabel}
                                                    selectedToken={selectedToken}
                                                    setSelectedToken={setSelectedToken}
                                                    embedded
                                                />
                                            )}
                                        </DialogContent>
                                    </Dialog>
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
