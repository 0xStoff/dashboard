import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Typography
} from "@mui/material";
import { Settings } from "@mui/icons-material";
import { theme } from "./utils/theme";
import { useFetchWallets } from "./hooks/useFetchWallets";
import {
  fetchAptosData,
  fetchCosmosTokens,
  fetchEvmAccounts,
  fetchSolanaData,
  fetchStaticData,
  fetchSuiData
} from "./api";
import { ChainList, NavHeader, ProtocolTable, SettingsDialog, Transactions, WalletTable } from "./components";
import { useFetchChains } from "./hooks/useFetchChains";

function App() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState("all");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideSmallBalances, setHideSmallBalances] = useState(10);
  const [openSettings, setOpenSettings] = useState(false);
  const [isCryptoView, setIsCryptoView] = useState(true);

  const wallets = useFetchWallets();
  const chains = useFetchChains();

  const fetchAccountsData = async () => {
    if (!wallets.length) return;


    try {
      setLoading(true);

      const [evmData, solData, cosmosData, suiData, aptosData, staticData] = await Promise.all([
        fetchEvmAccounts(wallets),
        fetchSolanaData(wallets.filter((w) => w.chain === "sol")),
        fetchCosmosTokens(wallets.filter((w) => w.chain === "cosmos")),
        fetchSuiData(),
        fetchAptosData(),
        fetchStaticData()]);

      const allTokens12 = wallets
        .map((wallet) => wallet.tokens || [])
        .flat();

      function transformData(wallets) {
        const tokenMap = new Map();

        wallets.forEach((wallet) => {
          const { id: walletId, wallet: walletAddress, tag, chain, tokens } = wallet;

          tokens.forEach((token) => {
            const tokenKey = `${token.name}-${token.chain_id}`; // Unique key for each token by name and chain

            if (!tokenMap.has(tokenKey)) {
              // If token doesn't exist, add it
              tokenMap.set(tokenKey, {
                // id: token.chain_id,
                chain_id: token.chain_id,
                name: token.name,
                symbol: token.symbol,
                decimals: token.decimals,
                logo_path: token.logo_path,
                price: parseFloat(token.price),
                price_24h_change: token.price_24h_change || null,
                amount: parseFloat(token.amount),
                is_core: token.is_core,
                wallets: [
                  {
                    tag,
                    id: walletId,
                    wallet: walletAddress,
                    amount: parseFloat(token.amount)
                  }
                ]
              });
            } else {
              // If token exists, update the amount and add wallet data
              const existingToken = tokenMap.get(tokenKey);
              existingToken.amount += parseFloat(token.amount);
              existingToken.wallets.push({
                tag,
                id: walletId,
                wallet: walletAddress,
                amount: parseFloat(token.amount)
              });
            }
          });
        });

        return Array.from(tokenMap.values());
      }

      const allTokens1 = transformData(wallets);


      const totalUSDValue = [...chains]
        .filter(Boolean)
        .reduce((sum, chain) => sum + (chain?.usd_value || chain?.total_usd_value || 0), 0);


      const allItem = {
        id: 0, tag: "all",
        chains: {
          total_usd_value: totalUSDValue,
          chain_list: [...chains]
        },
        tokens: allTokens1, protocols: evmData.allProtocols
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
  }, [wallets]);


  return (<ThemeProvider theme={theme}>
    <CssBaseline />
    <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />

    <Container sx={{ marginY: 10 }}>
      {loading ? (<CircularProgress />) : selectedItem ? (<>
        {!isCryptoView && <Transactions />}
        {isCryptoView && (
          <Container>
            <Card sx={{ marginY: 3, padding: 3, borderRadius: 10, width: 'fit-content' }}>
              <Typography variant="h5" fontWeight="bold">Net Worth</Typography>
              <Typography
                variant="h2"
                fontWeight="bold"
              >
                $ {selectedItem && (+selectedItem.tokens.reduce((acc, item) => acc + item.amount * item.price, 0)
                .toFixed(2)).toLocaleString("de-CH")}
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
          </Container>
        )}
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