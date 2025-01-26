import React, { useEffect, useMemo, useState } from "react";
import { ChainList, NavHeader, ProtocolTable, SettingsDialog, Transactions, WalletTable } from "./components";
import { Box, Card, Chip, CircularProgress, Container, CssBaseline, IconButton, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/system";
import { Settings } from "@mui/icons-material";
import { useFetchWallets } from "./hooks/useFetchWallets";
import { useFetchChains } from "./hooks/useFetchChains";
import { useFetchTokens } from "./hooks/useFetchTokens";
import { useFetchProtocolsTable } from "./hooks/useFetchProtocolsTable";
import { theme } from "./utils/theme";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import axios from "axios";


const NetWorthChart = ({ data }) => {
  const startDate = "2025-01-25";

  const formatDate = (dateString) => {
    return new Date(dateString).toISOString().split("T")[0];
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => formatDate(date)}
        />
        <YAxis
          tickFormatter={(value) => `$ ${(value / 1000).toLocaleString("de-CH")}k`}
        />
        <Tooltip
          content={({ payload, label }) => {
            if (payload && payload.length) {
              const value = payload[0].value;
              return (
                <Card sx={{ borderRadius: "10px", padding: "15px" }}>
                  <Typography fontWeight="bold" sx={{ lineHeight: 0.9 }}>{`$ ${Number(value).toLocaleString("de-CH")}`}</Typography>
                  <Typography variant="caption">
                    {formatDate(label)}
                  </Typography>
                </Card>
              );
            }
            return null;
          }}
        />
        <ReferenceLine x={startDate} stroke="#8884d8" />
        <Line
          type="monotone"
          dataKey="totalNetWorth"
          stroke="#8884d8"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};




const App = () => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChainId, setSelectedChainId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [hideSmallBalances, setHideSmallBalances] = useState(10);
  const [openSettings, setOpenSettings] = useState(false);
  const [isCryptoView, setIsCryptoView] = useState(true);
  const [netWorthData, setNetWorthData] = useState([]); // Start with an empty array

  const walletId = selectedItem ? selectedItem.id : "all";

  const API_BASE_URL = "http://localhost:3000/api";

  const { wallets, loading: walletsLoading } = useFetchWallets();
  const { chains, loading: chainsLoading } = useFetchChains(walletId);
  const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens(selectedChainId, walletId);
  const { protocolsTable, totalProtocolUSD, loading: protocolsTableLoading } = useFetchProtocolsTable(selectedChainId,
    walletId);

  const allItem = useMemo(() => {
    const totalUSDValue = totalTokenUSD + totalProtocolUSD;
    return {
      id: "all", tag: "all", chains: {
        total_usd_value: totalUSDValue, chain_list: chains
      }, tokens, protocolsTable
    };
  }, [chains, protocolsTable, tokens, totalProtocolUSD, totalTokenUSD]);

  const saveNetWorthToDB = async (totalNetWorth) => {
    try {
      // const date = new Date().toISOString().split("T")[0];
      const date = new Date().toISOString();

      const historyData = {
        wallets,
        chains,
        tokens,
        protocolsTable,
        totalProtocolUSD,
        totalTokenUSD,
      };
      const payload = { date, totalNetWorth, historyData };

      await axios.post(`${API_BASE_URL}/net-worth`, payload);
    } catch (error) {
      console.error("Error saving net worth to DB:", error);
    }
  };

  const fetchNetWorthData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/net-worth`);
      setNetWorthData(response.data);
    } catch (error) {
      console.error("Error fetching net worth data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountsData = async () => {
    setLoading(true);
    if (walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading) return;
    try {
      const totalNetWorth = totalTokenUSD + totalProtocolUSD;
      setSelectedItem(allItem);
      await saveNetWorthToDB(totalNetWorth.toFixed(0));
      await fetchNetWorthData();
    } catch (error) {
      console.error("Error fetching account data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetWorthData();
  }, []);

  useEffect(() => {
    fetchAccountsData();
  }, [walletsLoading, chainsLoading, tokensLoading, protocolsTableLoading]);

  const isLoading = loading || walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading;

  const renderNetWorth = () => (<Card sx={{ marginY: 3, padding: 3, borderRadius: 10, width: "fit-content" }}>
    <Typography variant="h5" fontWeight="bold">
      Net Worth
    </Typography>
    <Typography variant="h2" fontWeight="bold">
      $ {Number((totalTokenUSD + totalProtocolUSD).toFixed(2)).toLocaleString("de-CH")}
    </Typography>
  </Card>);

  const renderAccountChips = () => (<Box>
    {[{
      id: "all", tag: "all"
    }, ...wallets].map((acc, i) => (<Chip
      key={`${acc.id}-${i}`}
      sx={{ margin: 1 }}
      onClick={() => setSelectedItem(acc)}
      label={acc.tag}
      variant={selectedItem?.id === acc.id ? "outlined" : "filled"}
    />))}
    <IconButton color="primary" onClick={() => setOpenSettings(true)}>
      <Settings />
    </IconButton>
  </Box>);

  const renderIsLoading = () => <Box display="flex" justifyContent="center" alignItems="center">
    <CircularProgress />
  </Box>;

  return (<ThemeProvider theme={theme}>
    <CssBaseline />
    <NavHeader isCryptoView={isCryptoView} setIsCryptoView={setIsCryptoView} />
    <Container sx={{ marginY: 10 }}>
      {isLoading ? renderIsLoading() : selectedItem ? (<>
        {!isCryptoView && <><NetWorthChart data={netWorthData} /><Transactions /></>}
        {isCryptoView && (<>
          <Container>
            {renderNetWorth()}
            {renderAccountChips()}
          </Container>
          <Container sx={{ display: "flex", gap: 3, marginY: 3 }}>
            <ChainList
              chainIdState={[selectedChainId, setSelectedChainId]}
              data={chains}
            />
            <WalletTable
              chainList={chains}
              tokens={tokens}
            />
          </Container>
          <ProtocolTable
            protocols={protocolsTable}
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
};

export default App;