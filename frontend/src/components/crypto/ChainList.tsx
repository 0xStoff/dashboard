import React from "react";
import { Avatar, Box, Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { ChainIdState, ChainListInterface } from "../../interfaces/chain";
import { Account } from "../../interfaces/account";


const styles = {
  container: {
    flex: "0 0 auto", width: 200, maxWidth: 200
  }, card: {
    borderRadius: 10
  }, tableRow: (isActive: boolean) => ({
    cursor: "pointer",
    opacity: isActive ? 1 : 0.5,
    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.08)" },
    "&:last-child td, &:last-child th": { border: 0 }
  }), tableCell: { border: 0 }
};


const ChainList: React.FC<{
  chains: any; chainIdState: ChainIdState;
}> = ({ chains, chainIdState }) => {
  const [selectedChainId, setSelectedChainId] = chainIdState;

  if (!chains.length) return null;


  const handleRowClick = (chain: ChainListInterface) => {
    setSelectedChainId(selectedChainId === chain.chain_id ? "all" : chain.chain_id);
  };

  return (<Box sx={styles.container}>
      <Card sx={styles.card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ border: 0, padding: 3 }} colSpan={6}>
                <Typography variant="h5" fontWeight="bold">Chains</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
        <Box sx={{ height: 400, overflow: "auto", maxHeight: "fit-content" }}>
          <Table>
            <TableBody>
              {chains.map((chain) => (chain.usd_value > 10 && <TableRow
                  key={chain.chain_id}
                  hover
                  onClick={() => handleRowClick(chain)}
                  sx={styles.tableRow(selectedChainId === "all" || selectedChainId === chain.chain_id)}
                >
                  <TableCell
                    sx={{ display: "flex", alignItems: "center", ...styles.tableCell }}
                  >

                    <Avatar
                      alt={chain.name}
                      src={"http://localhost:3000/logos/" + chain.logo_path || ""}
                      sx={{ width: 35, height: 35 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", ...styles.tableCell }} align="right">
                    $ {(+chain.usd_value).toLocaleString("de-CH")}
                  </TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </Box>
      </Card>
    </Box>);
};

export default ChainList;