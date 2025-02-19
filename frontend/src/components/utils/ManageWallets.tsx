import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  CircularProgress,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel
} from "@mui/material";
import { Add, Delete, Edit, ContentCopy } from "@mui/icons-material";
import axios from "axios";
import { useFetchWallets } from "../../hooks/useFetchWallets";

const CHAIN_OPTIONS = ["evm", "cosmos", "sol", "sui", "aptos"];

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function ManageWallets() {
  const { wallets, loading: walletsLoading, refetch: fetchWallets } = useFetchWallets();
  const [newWallet, setNewWallet] = useState({ tag: "", wallet: "", chain: "", showChip: false });
  const [editingWallet, setEditingWallet] = useState<{ id: string; tag: string; wallet: string; chain: string; showChip: boolean } | null>(null);

  const handleAddWallet = async () => {
    if (!newWallet.tag.trim() || !newWallet.wallet.trim() || !newWallet.chain) return;
    try {
      delete newWallet.showChip;
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/wallets`, newWallet);
      setNewWallet({ tag: "", wallet: "", chain: "", showChip: false });
      fetchWallets();
    } catch (error) {
      console.error("Error adding wallet:", error);
    }
  };

  const handleEditWallet = async () => {
    if (!editingWallet || !editingWallet.tag.trim() || !editingWallet.wallet.trim() || !editingWallet.chain) return;
    try {
      await axios.put(`${process.env.REACT_APP_API_BASE_URL}/wallets/${editingWallet.id}`, editingWallet);
      setEditingWallet(null);
      fetchWallets();
    } catch (error) {
      console.error("Error updating wallet:", error);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/wallets/${id}`);
      fetchWallets();
    } catch (error) {
      console.error("Error deleting wallet:", error);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Manage Wallets
      </Typography>

      {walletsLoading ? (
        <CircularProgress />
      ) : (
        <List sx={{ maxHeight: 300, overflowY: "auto" }}>
          {wallets.map(wallet => (
            <ListItem
              key={wallet.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                paddingY: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1 }}>
                <Typography sx={{ minWidth: 80, fontWeight: 600 }}>{wallet.tag}</Typography>
                <Tooltip title={wallet.wallet} arrow>
                  <Typography
                    sx={{
                      fontFamily: "monospace",
                      background: "rgba(255, 255, 255, 0.05)",
                      padding: "4px 8px",
                      borderRadius: 1,
                    }}
                  >
                    {shortenAddress(wallet.wallet)}
                  </Typography>
                </Tooltip>
                <Tooltip title="Copy Address">
                  <IconButton size="small" onClick={() => handleCopyAddress(wallet.wallet)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography sx={{ color: "gray", fontSize: 14 }}>{wallet.chain}</Typography>
                {wallet.showChip && <Typography sx={{ color: "lightgreen", fontSize: 14 }}>✓ Show</Typography>}
              </Box>

              <Box>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => setEditingWallet(wallet)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={() => handleDeleteWallet(wallet.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </ListItem>
          ))}
        </List>
      )}

      {editingWallet ? (
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          <TextField
            label="Wallet Tag"
            value={editingWallet.tag}
            onChange={(e) => setEditingWallet({ ...editingWallet, tag: e.target.value })}
          />
          <TextField
            label="Wallet Address"
            value={editingWallet.wallet}
            onChange={(e) => setEditingWallet({ ...editingWallet, wallet: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Chain</InputLabel>
            <Select
              value={editingWallet.chain}
              onChange={(e) => setEditingWallet({ ...editingWallet, chain: e.target.value })}
            >
              {CHAIN_OPTIONS.map(chain => (
                <MenuItem key={chain} value={chain}>{chain}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={editingWallet.showChip}
                onChange={(e) => setEditingWallet({ ...editingWallet, showChip: e.target.checked })}
              />
            }
            label="Show as Chip"
          />
          <Button onClick={handleEditWallet} variant="contained">
            Save
          </Button>
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={2} mt={2}>
          <TextField
            label="Wallet Tag"
            value={newWallet.tag}
            onChange={(e) => setNewWallet({ ...newWallet, tag: e.target.value })}
          />
          <TextField
            label="Wallet Address"
            value={newWallet.wallet}
            onChange={(e) => setNewWallet({ ...newWallet, wallet: e.target.value })}
          />
          <FormControl fullWidth>
            <InputLabel>Chain</InputLabel>
            <Select
              value={newWallet.chain}
              onChange={(e) => setNewWallet({ ...newWallet, chain: e.target.value })}
            >
              {CHAIN_OPTIONS.map(chain => (
                <MenuItem key={chain} value={chain}>{chain}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={newWallet.showChip}
                onChange={(e) => setNewWallet({ ...newWallet, showChip: e.target.checked })}
              />
            }
            label="Show as Chip"
          />
          <Button onClick={handleAddWallet} startIcon={<Add />} variant="contained">
            Add Wallet
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default ManageWallets;