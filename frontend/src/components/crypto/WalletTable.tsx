import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { WalletList } from "../../interfaces/tokens";
import { Account } from "../../interfaces/account";
import { ChipWithTooltip } from "../utils/ChipWithTooltip";
import { Chain, ChainIdState } from "../../interfaces/chain";
import { useFetchChains } from "../../hooks/useFetchChains";



const styles = {
  container: {
    flex: 1
  }, card: {
    borderRadius: 10
  }, tableRow: {
    "&:last-child td, &:last-child th": { border: 0 }
  }, tableCell: { border: 0 }, avatarWrapper: {
    display: "flex", alignItems: "center", position: "relative", width: "fit-content"
  }, chainLogo: {
    width: 20,
    height: 20,
    position: "absolute",
    bottom: 0,
    right: 0,
    border: "1px solid",
    borderColor: "background.paper"
  }
};


const WalletTable: React.FC<{
  tokens: Account;
}> = ({ tokens, chainList }) => {

  // const filterAndSortData = useCallback((tokens: WalletList) => tokens
  //   // .filter((item) => item.amount * item.price > hideSmallBalances && item.is_core && (selectedChainId === "all" || item.chain === selectedChainId))
  //   .filter((item) => item.amount * item.price > hideSmallBalances && (selectedChainId === "all" || item.chain_id === selectedChainId))
  //   .sort((a, b) => b.amount * b.price - a.amount * a.price), [hideSmallBalances, selectedChainId]);
  //
  //
  // const sortedData = useMemo(() => (tokens.tokens ? filterAndSortData(tokens.tokens) : []),
  //   [tokens.tokens, filterAndSortData]);

  const totalUSD = useMemo(() => tokens.reduce((acc, item) => acc + item.amount * item.price, 0), [tokens]);

  if (!tokens.length) return null;


  const getChainLogo = (chainId: string) => chainList.find((c) => c.chain_id === chainId)?.logo_path || "";




  return (<Box sx={styles.container}>
    <Card sx={styles.card}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ border: 0, padding: 3 }} colSpan={6}>
              <Typography variant="h5" fontWeight="bold">Wallet</Typography>
              <Typography variant="body2" fontWeight="bold">
                $ {(+totalUSD.toFixed(2)).toLocaleString("de-CH")}
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
      </Table>
      <Box sx={{ height: 600, maxHeight: "fit-content", overflow: "auto" }}>
        <Table sx={{ maxHeight: "fit-content" }}>
          <TableBody>
            {tokens.map((item, index) => (
              <TableRow key={index} sx={styles.tableRow}>
              <TableCell sx={styles.tableCell}>
                <Box sx={styles.avatarWrapper}>
                  <Avatar
                    alt={item.name}
                    src={"http://localhost:3000/logos/" + item.logo_path || ""}
                    // src={item.logo_url || ""}
                    sx={{ width: 35, height: 35, marginRight: 1 }}
                  />
                  {item.chain_id && (<Avatar
                    alt={item.chain_id}
                    src={"http://localhost:3000/logos/" + getChainLogo(item.chain_id)}
                    // src={getChainLogo(item.chain)}
                    sx={styles.chainLogo}
                  />)}
                </Box>
              </TableCell>
              <TableCell sx={styles.tableCell} align="left">
                <Typography fontWeight="bold" marginLeft={2} variant="body2" noWrap>
                  {item.symbol}
                </Typography>
              </TableCell>
              <TableCell sx={styles.tableCell} align="left">
                {item.price_24h_change && (
                  <Typography
                    fontWeight="bold"
                    marginLeft={2}
                    variant="body2"
                    noWrap
                    sx={{ color: item.price_24h_change >= 0 ? "success.main" : "error.main" }}
                  >
                    {parseFloat(item.price_24h_change).toFixed(2)} %
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={styles.tableCell} align="right">
                {item.wallets?.map((wallet) => (<ChipWithTooltip key={wallet.id} item={item} wallet={wallet} />))}
              </TableCell>
              <TableCell sx={{ ...styles.tableCell, whiteSpace: "nowrap" }} align="right">
                {/*$ {item.price >= 0.1 ? item.price.toFixed(2) : item.price.toFixed(6)}*/}
                $ {item.price >= 0.1 ? parseFloat(item.price).toFixed(2) : parseFloat(item.price).toFixed(6)}
              </TableCell>
              <TableCell sx={styles.tableCell} align="right">
                {parseFloat(item.amount).toFixed(2)} {item.symbol}
              </TableCell>
              <TableCell sx={{ ...styles.tableCell, fontWeight: "bold", whiteSpace: "nowrap" }}
                         align="right">
                $ {(item.amount * item.price).toFixed(2)}
              </TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </Box>
    </Card>
  </Box>);
};

export default React.memo(WalletTable);