import React, { useEffect, useState, useCallback } from "react";
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
  CssBaseline, IconButton, Tooltip,
  Typography, useMediaQuery
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
import {TokenChart} from "./components/crypto/TokenChart";

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

export const tokensData = [
  {
    name: "Ethereum",
    symbol: "ETH",
    history: [
      { date: "2025-02-20", balance: 1.2, usdValue: 3000 },
      { date: "2025-02-21", balance: 1.5, usdValue: 3300 },
      { date: "2025-02-22", balance: 1.3, usdValue: 3100 },
    ],
  },
  {
    name: "Bitcoin",
    symbol: "BTC",
    history: [
      { date: "2025-02-20", balance: 0.1, usdValue: 5000 },
      { date: "2025-02-21", balance: 0.15, usdValue: 7500 },
      { date: "2025-02-22", balance: 0.12, usdValue: 6000 },
    ],
  },
];

const App: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [isCryptoView, setIsCryptoView] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showChart, setShowChart] = useState<boolean>(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const walletId: string = selectedItem?.id || "all";

  const { netWorth, loading: netWorthLoading, saveNetWorth } = useFetchNetWorth();
  const { wallets, loading: walletsLoading } = useFetchWallets();
  const { chains, loading: chainsLoading } = useFetchChains(walletId, searchQuery);
  const { tokens, totalTokenUSD, loading: tokensLoading } = useFetchTokens(selectedChainId, walletId, searchQuery);
  const { protocolsTable, totalProtocolUSD, loading: protocolsTableLoading } = useFetchProtocolsTable(
    selectedChainId,
    walletId,
    searchQuery,
  );

  const totalUSDValue: number = totalTokenUSD + totalProtocolUSD;

  console.log(netWorth.history)
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

      saveNetWorth(totalUSDValue, {
        wallets,
        chains,
        tokens,
        protocolsTable,
        totalProtocolUSD,
        totalTokenUSD,
      }).catch((err) => console.error("Error saving net worth:", err));

    } catch (error) {
      console.error("Error fetching account data:", error);
    } finally {
      setLoading(false);
    }
  }, [totalUSDValue, chains, tokens, protocolsTable]);

  useEffect(() => {
    if (!walletsLoading && !chainsLoading && !tokensLoading && !protocolsTableLoading) {
      fetchAccountsData();
    }
  }, [walletsLoading, chainsLoading, tokensLoading, protocolsTableLoading]);

  const isLoading: boolean = loading || walletsLoading || chainsLoading || tokensLoading || protocolsTableLoading

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NavHeader
        isCryptoView={isCryptoView}
        setIsCryptoView={setIsCryptoView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <Container sx={{ marginY: 10 }}>
        {isLoading && (
          <Box display="flex" justifyContent="center" alignItems="center">
            <CircularProgress />
          </Box>
        )}

        {!isLoading && !selectedItem && <Typography>No data available</Typography>}

        {!isLoading && selectedItem && (
          <>
            {isCryptoView && !netWorthLoading ? (
              <>
                {!isMobile && <Box display="flex" justifyContent="flex-end" mb={2}>
                  <IconButton
                    color="primary"
                    onClick={() => setShowChart((prev) => !prev)}
                  >
                    {showChart ? <SyncAlt fontSize="medium" /> : <BarChart fontSize="medium" />}
                  </IconButton>
                </Box>}
                <Header wallets={wallets} totalUSDValue={totalUSDValue} selectedItemState={[selectedItem, setSelectedItem]} />
                {showChart && <NetWorthChart data={netWorth} />}
                {/*<div>*/}
                {/*  <h2>Token List</h2>*/}
                {/*  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>*/}
                {/*    {tokensData.map((token) => (*/}
                {/*        <button*/}
                {/*            key={token.symbol}*/}
                {/*            onClick={() => setSelectedToken(token)}*/}
                {/*            style={{*/}
                {/*              padding: "10px",*/}
                {/*              cursor: "pointer",*/}
                {/*              border: selectedToken?.symbol === token.symbol ? "2px solid blue" : "1px solid gray",*/}
                {/*            }}*/}
                {/*        >*/}
                {/*          {token.name} ({token.symbol})*/}
                {/*        </button>*/}
                {/*    ))}*/}
                {/*  </div>*/}

                {/*  {selectedToken && <TokenChart token={selectedToken} />}*/}
                {/*</div>*/}
                <Container sx={{ display: "flex", gap: 3, marginY: 3, flexDirection: { xs: "column", md: "row" }}}>
                  <ChainList chains={chains} chainIdState={[selectedChainId, setSelectedChainId]} />
                  <WalletTable chainList={chains} tokens={tokens} />
                </Container>
                <ProtocolTable protocols={protocolsTable} />
              </>
            ) :  (
              <>
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