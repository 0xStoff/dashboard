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
import { ChainList, NavHeader, ProtocolTable, SettingsDialog, Transactions, WalletTable } from "./components";
import { useFetchChains } from "./hooks/useFetchChains";
import { useFetchProtocols } from "./hooks/useFetchProtocols";

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
  const protocols = useFetchProtocols();

  function calculateTotalUSD(data) {
    return data.reduce((protocolSum, protocol) => {
      const walletsSum = protocol.wallets.reduce((walletSum, wallet) => {
        const portfolioSum = wallet.portfolio_item_list.reduce((itemSum, item) => {
          return itemSum + (item.stats.net_usd_value || 0); // Add net USD value of each portfolio item
        }, 0);
        return walletSum + portfolioSum; // Sum across all portfolio items in the wallet
      }, 0);
      return protocolSum + walletsSum; // Sum across all wallets in the protocol
    }, 0);
  }

  function transformData(wallets) {
    const tokenMap = new Map();

    wallets.forEach((wallet) => {
      const { id: walletId, wallet: walletAddress, tag, tokens } = wallet;

      tokens.forEach((token) => {
        const tokenKey = `${token.name}-${token.chain_id}`;

        if (!tokenMap.has(tokenKey)) {
          tokenMap.set(tokenKey, {
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

  const fetchAccountsData = async () => {
    if (!wallets.length) return;


    try {
      setLoading(true);

      const totalTokenUSD = transformData(wallets).reduce((acc, item) => acc + item.amount * item.price, 0) || 0;
      const totalProtocolUSD = calculateTotalUSD(protocols);


      const allItem = {
        id: 0, tag: "all",
        chains: {
          total_usd_value: totalTokenUSD + totalProtocolUSD,
          chain_list: [...chains]
        },
        tokens: transformData(wallets),
        protocols
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
  }, [wallets, fetchAccountsData]);



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