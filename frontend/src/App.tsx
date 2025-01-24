import React, { useEffect, useState } from "react";
import { useFetchWallets } from "./hooks/useFetchWallets";
import { useFetchChains } from "./hooks/useFetchChains";
import { useFetchProtocols } from "./hooks/useFetchProtocols";
import { useFetchTokens } from "./hooks/useFetchTokens";
import { ChainList, NavHeader, ProtocolTable, SettingsDialog, Transactions, WalletTable } from "./components";
import { Card, Chip, CircularProgress, Container, CssBaseline, IconButton, Typography } from "@mui/material";
import { Box, ThemeProvider } from "@mui/system";
import { theme } from "./utils/theme";
import { Settings } from "@mui/icons-material";

function App() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState("all");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideSmallBalances, setHideSmallBalances] = useState(10);
  const [openSettings, setOpenSettings] = useState(false);
  const [isCryptoView, setIsCryptoView] = useState(true);

  const { wallets, loading: walletsLoading } = useFetchWallets();
  const { chains, loading: chainsLoading } = useFetchChains();
  const { protocols, totalProtocolUSD, loading: protocolsLoading } = useFetchProtocols();
  const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens();

  const fetchAccountsData = async () => {
    if (walletsLoading || chainsLoading || protocolsLoading || tokensLoading) {
      return;
    }

    try {
      setLoading(true);

      const allItem = {
        id: 0, tag: "all", chains: {
          total_usd_value: totalTokenUSD + totalProtocolUSD,
          chain_list: [...chains]
        }, tokens, protocols
      };

      setList([allItem, ...wallets]);
      setSelectedItem(allItem);
    } catch (error) {
      console.error("Error fetching account data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsData();
  }, [walletsLoading, chainsLoading, protocolsLoading, tokensLoading]);

  const isLoading = loading || walletsLoading || chainsLoading || protocolsLoading || tokensLoading;


  return (<ThemeProvider theme={theme}>
      <CssBaseline />
      <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />
      <Container sx={{ marginY: 10 }}>
        {isLoading ? (<Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>) : selectedItem ? (<>
            {!isCryptoView && <Transactions />}
            {isCryptoView && (<Container>
                <Card
                  sx={{ marginY: 3, padding: 3, borderRadius: 10, width: "fit-content" }}
                >
                  <Typography variant="h5" fontWeight="bold">
                    Net Worth
                  </Typography>
                  <Typography variant="h2" fontWeight="bold">
                    $ {Number(selectedItem.chains.total_usd_value.toFixed(2)).toLocaleString("de-CH")}
                  </Typography>
                </Card>
                <Box>
                  {list.map((acc, i) => (<Chip
                      key={`${acc.id}-${i}`}
                      sx={{ margin: 1 }}
                      onClick={() => setSelectedItem(acc)}
                      label={acc.tag}
                      variant={selectedItem === acc ? "outlined" : "filled"}
                    />))}
                  <IconButton color="primary" onClick={() => setOpenSettings(true)}>
                    <Settings />
                  </IconButton>
                </Box>
              </Container>)}
            {isCryptoView && (<>
                <Container sx={{ display: "flex", gap: 3, marginY: 3 }}>
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