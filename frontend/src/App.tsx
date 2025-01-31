import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChainList,
  NavHeader,
  ProtocolTable,
  Transactions,
  WalletTable,
} from "./components";
import {
  Box,
  CircularProgress,
  Container,
  CssBaseline,
  Typography,
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

const App = () => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [isCryptoView, setIsCryptoView] = useState(true);

  const walletId = selectedItem?.id || "all";

  const { netWorth, loading: netWorthLoading, saveNetWorth } = useFetchNetWorth();
  const { wallets, loading: walletsLoading } = useFetchWallets();
  const { chains, loading: chainsLoading } = useFetchChains(walletId);
  const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens(
    selectedChainId,
    walletId
  );
  const {
          protocolsTable,
          totalProtocolUSD,
          loading: protocolsTableLoading,
        } = useFetchProtocolsTable(selectedChainId, walletId);

  const totalUSDValue = totalTokenUSD + totalProtocolUSD;

  const allItem = useMemo(
    () => ({
      id: "all",
      tag: "all",
      chains: { total_usd_value: totalUSDValue, chain_list: chains },
      tokens,
      protocolsTable,
    }),
    [chains, protocolsTable, tokens, totalUSDValue]
  );

  const fetchAccountsData = useCallback(async () => {
    if (walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading) return;

    setLoading(true);
    try {
      setSelectedItem(allItem);
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
  }, [
    walletsLoading,
    chainsLoading,
    tokensLoading,
    protocolsTableLoading,
  ]);

  useEffect(() => {
    fetchAccountsData();
  }, [walletsLoading, chainsLoading, tokensLoading, protocolsTableLoading, fetchAccountsData]);

  const isLoading = loading || walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />

      <Container sx={{ marginY: 10 }}>
        {isLoading && (
          <Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>
        )}

        {!isLoading && !selectedItem && <Typography>No data available</Typography>}

        {!isLoading && selectedItem && (
          <>
            {isCryptoView ? (
              <>
                <Header
                  wallets={wallets}
                  totalUSDValue={totalUSDValue}
                  selectedItemState={[selectedItem, setSelectedItem]}
                />
                <Container sx={{ display: "flex", gap: 3, marginY: 3 }}>
                  <ChainList
                    chains={chains}
                    chainIdState={[selectedChainId, setSelectedChainId]}
                  />
                  <WalletTable chainList={chains} tokens={tokens} />
                </Container>
                <ProtocolTable protocols={protocolsTable} />
              </>
            ) : (
              <>
                <NetWorthChart data={netWorth} />
                <Transactions />
              </>
            )}
          </>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default App;