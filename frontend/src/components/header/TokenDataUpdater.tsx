import React, { useCallback, useState } from "react";
import {
  IconButton, Tooltip, CircularProgress,
  Button, Dialog, DialogActions,
  DialogContent, DialogTitle, Box, Select,
  MenuItem, FormControl, InputLabel
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Snackbar from "../utils/Snackbar";
import { useFetchWallets } from "../../hooks/useFetchWallets";
import {useWallets} from "../../context/WalletsContext";
import apiClient from "../../utils/api-client";

const TokenDataUpdater = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");

  const { wallets, loading: walletsLoading } = useWallets();

  const handleUpdate = useCallback(async (type: "all" | "other" | "evm" | "evm_wallet") => {
    setIsLoading(true);
    localStorage.clear();

    let endpoint = "/wallets/refetch";

    switch (type) {
      case "all":
        setMessage("🔄 Fetching Token Data for All Wallets...");
        break;
      case "other":
        setMessage("🔄 Fetching Other Token Data...");
        endpoint = "/wallets/refetch/other";
        break;
      case "evm":
        setMessage("🔄 Fetching EVM Token Data...");
        endpoint = "/wallets/refetch/evm";
        break;
      case "evm_wallet":
        if (!selectedWallet) {
          setMessage("❌ Please select a wallet.");
          setSnackbarOpen(true);
          setIsLoading(false);
          return;
        }
        setMessage(`🔄 Fetching EVM Token Data for Wallet: ${selectedWallet}...`);
        endpoint = `/wallets/refetch/evm/${selectedWallet}`;
        break;
      default:
        setMessage("❌ Invalid fetch type.");
        setIsLoading(false);
        return;
    }

    setSnackbarOpen(true);
    setModalOpen(false);

    try {
      const response = await apiClient.post(endpoint);

      setMessage(response.statusText || "🎉 Token Data Fetched Successfully!");
    } catch (error) {
      setMessage("❌ Error fetching token data.");
    } finally {
      setIsLoading(false);
      setSnackbarOpen(true);
    }
  }, [selectedWallet]);



  return (
      <>
        <Tooltip title="Refetch Token Data">
          <IconButton color="primary" onClick={() => setModalOpen(true)}>
            <RefreshIcon fontSize="medium" />
          </IconButton>
        </Tooltip>

        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Select Refetch Option</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Button onClick={() => handleUpdate("all")} variant="contained" disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} /> : "Refetch All Wallets"}
              </Button>

              <Button onClick={() => handleUpdate("other")} variant="contained" disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} /> : "Refetch Other Tokens"}
              </Button>

              <Button onClick={() => handleUpdate("evm")} variant="contained" disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} /> : "Refetch EVM (All Wallets)"}
              </Button>

              {walletsLoading ? (
                  <p style={{ textAlign: "center", color: "gray" }}>Loading wallets...</p>
              ) : wallets.length > 0 ? (
                  <FormControl fullWidth>
                    <InputLabel>Select Wallet</InputLabel>
                    <Select
                        value={selectedWallet || null}
                        onChange={(e) => setSelectedWallet(e.target.value)}
                        displayEmpty
                    >
                      <MenuItem value="" disabled>Select a wallet</MenuItem>
                      {wallets.map((wallet) => (
                          <MenuItem key={wallet.id} value={wallet.id}>
                            {wallet.tag}
                          </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
              ) : (
                  <p style={{ textAlign: "center", color: "gray" }}>No wallets available</p>
              )}

              <Button
                  onClick={() => handleUpdate("evm_wallet")}
                  variant="contained"
                  disabled={isLoading || wallets.length === 0}
              >
                {isLoading ? <CircularProgress size={24} /> : "Refetch EVM (By Wallet)"}
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)} color="secondary">
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbarOpen} message={message} handleClose={() => setSnackbarOpen(false)} />
      </>
  );
};

export default TokenDataUpdater;