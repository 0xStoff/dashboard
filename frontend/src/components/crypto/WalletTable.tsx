import React, { useMemo } from "react";
import { Avatar, Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery } from "@mui/material";
import { ChipWithTooltip } from "../utils/ChipWithTooltip";
import { formatNumber, toFixedString } from "../../utils/number-utils";
import { Token } from "../../interfaces";
import { useTheme } from "@mui/material/styles";

const styles = {
  container: { flex: 1 },
  card: { borderRadius: 10, overflowX: "auto" }, // Enable horizontal scrolling if needed
  tableRow: { "&:last-child td, &:last-child th": { border: 0 } },
  tableCell: { border: 0 },
  avatarWrapper: {
    display: "flex",
    alignItems: "center",
    position: "relative",
    width: "fit-content"
  },
  chainLogo: {
    width: 20,
    height: 20,
    position: "absolute",
    bottom: 0,
    right: 0,
    border: "1px solid",
    borderColor: "background.paper"
  }
};

const WalletTable: React.FC<{ tokens: Token[] }> = ({ tokens, chainList }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const totalUSD = useMemo(
    () => tokens.reduce((acc, item) => acc + item.amount * item.price, 0),
    [tokens]
  );

  if (!tokens.length) return null;

  const getChainLogo = (chainId: string) =>
    chainList.find((c) => c.chain_id === chainId)?.logo_path || "";

  return (
    <Box sx={styles.container}>
      <Card sx={styles.card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ border: 0, padding: 2 }} colSpan={isMobile ? 3 : 6}>
                <Typography variant="h5" fontWeight="bold">Wallet</Typography>
                <Typography variant="body2" fontWeight="bold">
                  $ {toFixedString(totalUSD)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
        <Box sx={{ height: 600, maxHeight: "fit-content", overflowX: "auto" }}>
          <Table>
            <TableBody>
              {tokens.map((item, index) => (
                item.amount * item.price > 10 && (
                  <TableRow key={index} sx={styles.tableRow}>
                    {/* Avatar + Token Symbol */}
                    <TableCell sx={styles.tableCell}>
                      <Box sx={styles.avatarWrapper}>
                        <Avatar
                          alt={item.name}
                          src={"http://stoeff.xyz:3000/logos/" + item.logo_path || ""}
                          sx={{ width: isMobile ? 30 : 35, height: isMobile ? 30 : 35, marginRight: 1 }}
                        />
                        {getChainLogo(item.chain_id) && (
                          <Avatar
                            alt={item.chain_id}
                            src={"http://stoeff.xyz:3000/logos/" + getChainLogo(item.chain_id)}
                            sx={{ ...styles.chainLogo, width: isMobile ? 15 : 20, height: isMobile ? 15 : 20 }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {!isMobile && <TableCell sx={styles.tableCell} align="left">
                      <Typography fontWeight="bold" marginLeft={2} variant="body2" noWrap>
                        {item.symbol}
                      </Typography>
                    </TableCell>}

                    {!isMobile && (
                      <TableCell sx={styles.tableCell} align="left">
                        {item.price_24h_change && (
                          <Typography
                            fontWeight="bold"
                            marginLeft={2}
                            variant="body2"
                            noWrap
                            sx={{ color: item.price_24h_change >= 0 ? "success.main" : "error.main" }}
                          >
                            {toFixedString(item.price_24h_change)} %
                          </Typography>
                        )}
                      </TableCell>
                    )}

                      <TableCell sx={styles.tableCell} align="right">
                        {item.wallets?.map((wallet) => (
                          <ChipWithTooltip key={wallet.id} item={item} wallet={wallet} />
                        ))}
                      </TableCell>
                    {!isMobile && (
                    <TableCell sx={{ ...styles.tableCell, whiteSpace: "nowrap" }} align="right">
                      $ {formatNumber(item.price, "price")}
                    </TableCell>
                    )}

                    {!isMobile && (
                      <TableCell sx={styles.tableCell} align="right">
                        {formatNumber(item.amount, "amount")} {item.symbol}
                      </TableCell>
                    )}

                    <TableCell
                      sx={{
                        ...styles.tableCell,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                      align="right"
                    >
                      $ {toFixedString(item.amount * item.price)}
                    </TableCell>
                  </TableRow>
                )
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
};

export default React.memo(WalletTable);