import React, { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  Menu,
  MenuItem,
  IconButton
} from "@mui/material";
import { ArrowDropUp, ArrowDropDown } from "@mui/icons-material";
import { Token } from "../../interfaces";
import { useTheme } from "@mui/material/styles";
import { formatNumber, toFixedString } from "../../utils/number-utils";
import { ChipWithTooltip } from "../utils/ChipWithTooltip";

const styles = {
  container: { flex: 1 },
  card: { borderRadius: 10, overflowX: "auto", position: "relative", padding: 2 },
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
  },
  sortButton: {
    position: "absolute",
    top: 10,
    right: 10
  }
};

const WalletTable: React.FC<{ tokens: Token[], chainList: any[] }> = ({ tokens, chainList }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [sortConfig, setSortConfig] = useState({ key: "holdings", order: "desc" });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const totalUSD = useMemo(() =>
      tokens.reduce((acc, item) => acc + item.amount * item.price, 0),
    [tokens]
  );

  if (!tokens.length) return null;

  const getChainLogo = (chainId: string) =>
    chainList.find((c) => c.chain_id === chainId)?.logo_path || "";

  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      const valueA = sortConfig.key === "holdings" ? a.amount * a.price : (a.price_24h_change || 0);
      const valueB = sortConfig.key === "holdings" ? b.amount * b.price : (b.price_24h_change || 0);
      return sortConfig.order === "asc" ? valueA - valueB : valueB - valueA;
    });
  }, [tokens, sortConfig]);

  const handleSortChange = (key: "holdings" | "change") => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key ? (prev.order === "asc" ? "desc" : "asc") : "desc"
    }));
    setMenuAnchor(null);
  };

  return (
    <Box sx={styles.container}>
      <Card sx={styles.card}>
        {/* Sorting Button in Upper Right Corner */}
        <IconButton sx={styles.sortButton} onClick={(e) => setMenuAnchor(e.currentTarget)}>
          {sortConfig.order === "asc" ? <ArrowDropUp /> : <ArrowDropDown />}
        </IconButton>

        {/* Sorting Menu */}
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => handleSortChange("holdings")}>Sort by Holdings</MenuItem>
          <MenuItem onClick={() => handleSortChange("change")}>Sort by 24h Change</MenuItem>
        </Menu>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ border: 0, padding: 2 }} colSpan={isMobile ? 3 : 6}>
                <Typography variant="h5" fontWeight="bold">Wallet</Typography>
                <Typography variant="body2" fontWeight="bold">$ {toFixedString(totalUSD)}</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>

        <Box sx={{ height: 600, overflowX: "auto" }}>
          <Table>
            <TableBody>
              {sortedTokens.map((item, index) => (
                item.amount * item.price > 10 && (
                  <TableRow key={index} sx={styles.tableRow}>
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

                    <TableCell sx={styles.tableCell} align="right">
                      {item.wallets?.map((wallet) => (
                        <ChipWithTooltip key={wallet.id} item={item} wallet={wallet} />
                      ))}
                    </TableCell>

                    <TableCell sx={{ ...styles.tableCell, fontWeight: "bold", whiteSpace: "nowrap" }} align="right">
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