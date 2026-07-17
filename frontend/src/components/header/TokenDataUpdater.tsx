import React, { useCallback, useState } from "react";
import { formatDistanceToNow, format, isToday } from "date-fns";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  type AlertColor,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Snackbar from "../utils/Snackbar";
import { useWallets } from "../../context/WalletsContext";
import apiClient from "../../utils/api-client";

const TokenDataUpdater: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState<AlertColor>("success");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => localStorage.getItem("lastUpdated"));

  const { wallets, loading: walletsLoading } = useWallets();

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "-";

    return isToday(date)
      ? `Today, ${format(date, "HH:mm")}`
      : formatDistanceToNow(date, { addSuffix: true });
  };

  const handleUpdate = useCallback(
    async (type: "all" | "other" | "evm" | "evm_wallet") => {
      setIsLoading(true);
      let endpoint = "/wallets/refetch";

      switch (type) {
        case "all":
          setMessageSeverity("info");
          setMessage("Refreshing all wallet data...");
          break;
        case "other":
          setMessageSeverity("info");
          endpoint = "/wallets/refetch/other";
          setMessage("Refreshing static and non-EVM data...");
          break;
        case "evm":
          setMessageSeverity("info");
          endpoint = "/wallets/refetch/evm";
          setMessage("Refreshing all EVM wallet data...");
          break;
        case "evm_wallet":
          if (!selectedWallet) {
            setMessageSeverity("warning");
            setMessage("Please select a wallet first.");
            setSnackbarOpen(true);
            setIsLoading(false);
            return;
          }
          endpoint = `/wallets/refetch/evm/${selectedWallet}`;
          setMessageSeverity("info");
          setMessage(`Refreshing EVM data for wallet ${selectedWallet}...`);
          break;
        default:
          setMessageSeverity("error");
          setMessage("Invalid refresh option.");
          setSnackbarOpen(true);
          setIsLoading(false);
          return;
      }

      setSnackbarOpen(true);
      setModalOpen(false);

      try {
        const response = await apiClient.post(endpoint);
        setMessageSeverity("success");
        setMessage(response.data?.message || "Token data refreshed successfully.");
        const now = new Date().toISOString();
        setLastUpdated(now);
        localStorage.setItem("lastUpdated", now);
      } catch (error) {
        console.error(error);
        setMessageSeverity("error");
        setMessage("Failed to refresh token data.");
      } finally {
        setIsLoading(false);
        setSnackbarOpen(true);
      }
    },
    [selectedWallet]
  );

  return (
    <>
      <Tooltip title="Refetch Token Data">
        <IconButton color="primary" onClick={() => setModalOpen(true)}>
          <RefreshIcon fontSize="medium" />
        </IconButton>
      </Tooltip>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select Refetch Option</DialogTitle>
        <Typography sx={{ mb: 1, textAlign: "center", fontSize: 14, color: "gray" }}>
          Last Updated: {lastUpdated ? formatLastUpdated(lastUpdated) : "-"}
        </Typography>
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
              <Typography textAlign="center" color="gray">
                Loading wallets...
              </Typography>
            ) : wallets.length > 0 ? (
              <FormControl fullWidth>
                <InputLabel id="wallet-refetch-label">Wallet</InputLabel>
                <Select
                  labelId="wallet-refetch-label"
                  label="Wallet"
                  value={selectedWallet}
                  onChange={(event) => setSelectedWallet(String(event.target.value))}
                >
                  <MenuItem value="" disabled>
                    Select wallet
                  </MenuItem>
                  {wallets.map((wallet) => (
                    <MenuItem key={wallet.id} value={wallet.id}>
                      {wallet.tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Typography textAlign="center" color="gray">
                No wallets available
              </Typography>
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

      <Snackbar
        open={snackbarOpen}
        message={message}
        severity={messageSeverity}
        handleClose={() => setSnackbarOpen(false)}
      />
    </>
  );
};

export default TokenDataUpdater;
