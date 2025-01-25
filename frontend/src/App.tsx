import React, { useEffect, useMemo, useState } from "react";
import {
  ChainList,
  NavHeader,
  ProtocolTable,
  SettingsDialog,
  Transactions,
  WalletTable,
} from "./components";
import {
  Card,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  IconButton,
  Typography,
  Box,
} from "@mui/material";
import { ThemeProvider } from "@mui/system";
import { Settings } from "@mui/icons-material";
import { useFetchWallets } from "./hooks/useFetchWallets";
import { useFetchChains } from "./hooks/useFetchChains";
import { useFetchTokens } from "./hooks/useFetchTokens";
import { useFetchProtocolsTable } from "./hooks/useFetchProtocolsTable";
import { theme } from "./utils/theme";

const App = () => {
  // State Variables
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [hideSmallBalances, setHideSmallBalances] = useState(10);
  const [openSettings, setOpenSettings] = useState(false);
  const [isCryptoView, setIsCryptoView] = useState(true);

  // Fetching Data
  const walletId = selectedItem ? selectedItem.id : "all";

  const { wallets, loading: walletsLoading } = useFetchWallets();
  const { chains, loading: chainsLoading } = useFetchChains();
  const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens(selectedChainId, walletId);
  const { protocolsTable, totalProtocolUSD, loading: protocolsTableLoading } = useFetchProtocolsTable(selectedChainId, walletId);

  const allItem = useMemo(() => {
    const totalUSDValue = totalTokenUSD + totalProtocolUSD;
    return {
      id: 'all',
      tag: "all",
      chains: {
        total_usd_value: totalUSDValue,
        chain_list: chains,
      },
      tokens,
      protocolsTable,
    };
  }, [chains, protocolsTable, tokens, totalProtocolUSD, totalTokenUSD]);


  const fetchAccountsData = async () => {
    if (walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading) return;
    setLoading(true);
    try {
      setSelectedItem(allItem);
    } catch (error) {
      console.error("Error fetching account data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
  }, [walletsLoading, chainsLoading, tokensLoading, protocolsTableLoading]);

  const isLoading =
          loading || walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading;

  const renderNetWorth = () => (
    <Card sx={{ marginY: 3, padding: 3, borderRadius: 10, width: "fit-content" }}>
      <Typography variant="h5" fontWeight="bold">
        Net Worth
      </Typography>
      <Typography variant="h2" fontWeight="bold">
        {/*$ {Number(selectedItem.chains.total_usd_value.toFixed(2)).toLocaleString("de-CH")}*/}
      </Typography>
    </Card>
  );

  const renderAccountChips = () => (
    <Box>
      {[allItem, ...wallets].map((acc, i) => (
        <Chip
          key={`${acc.id}-${i}`}
          sx={{ margin: 1 }}
          onClick={() => setSelectedItem(acc)}
          label={acc.tag}
          variant={selectedItem === acc ? "outlined" : "filled"}
        />
      ))}
      <IconButton color="primary" onClick={() => setOpenSettings(true)}>
        <Settings />
      </IconButton>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />
      <Container sx={{ marginY: 10 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>
        ) : selectedItem ? (
          <>
            {!isCryptoView && <Transactions />}
            {isCryptoView && (
              <Container>
                {renderNetWorth()}
                {renderAccountChips()}
              </Container>
            )}
            {isCryptoView && (
              <>
                <Container sx={{ display: "flex", gap: 3, marginY: 3 }}>
                  <ChainList
                    chainIdState={[selectedChainId, setSelectedChainId]}
                    data={selectedItem}
                    hideSmallBalances={hideSmallBalances}
                  />
                  <WalletTable
                    chainList={chains}
                    tokens={tokens}
                  />
                </Container>
                <ProtocolTable
                  protocols={protocolsTable}
                  hideSmallBalances={hideSmallBalances}
                />
              </>
            )}
          </>
        ) : (
          <Typography>No data available</Typography>
        )}
      </Container>
      <SettingsDialog
        hideSmallBalances={hideSmallBalances}
        setHideSmallBalances={setHideSmallBalances}
        openSettings={openSettings}
        setOpenSettings={setOpenSettings}
      />
    </ThemeProvider>
  );
};

export default App;