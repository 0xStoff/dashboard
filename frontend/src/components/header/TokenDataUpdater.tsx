import React, { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow, format, isToday } from "date-fns";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  ListItemText,
  Select,
  Stack,
  TextField,
  type AlertColor,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Snackbar from "../utils/Snackbar";
import { useWallets } from "../../context/WalletsContext";
import apiClient from "../../utils/api-client";

type RefreshJob = {
  id: number;
  status: "queued" | "running" | "completed" | "completed_with_warnings" | "failed" | "interrupted";
  progress?: { phase?: string; current?: number; total?: number; walletId?: number; provider?: string };
  result?: { results?: Array<{ status?: string; provider?: string; tag?: string; error?: string }> } | null;
  error?: string | null;
};

const isTerminalJob = (status?: RefreshJob["status"]) =>
  status === "completed" || status === "completed_with_warnings" || status === "failed" || status === "interrupted";

const walletStoredValue = (wallet: { approximate_usd_value?: number }) =>
  Math.max(0, Number(wallet.approximate_usd_value || 0));

const formatStoredValue = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: value > 0 && value < 10 ? 2 : 0,
    maximumFractionDigits: value < 10 ? 2 : 0,
  })}`;

const TokenDataUpdater: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState<AlertColor>("success");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWalletIds, setSelectedWalletIds] = useState<number[]>([]);
  const [minimumWalletUsd, setMinimumWalletUsd] = useState<number>(() => {
    const stored = Number(localStorage.getItem("walletRefreshMinimumUsd"));
    return Number.isFinite(stored) && stored >= 0 ? stored : 25;
  });
  const [activeJob, setActiveJob] = useState<RefreshJob | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(() => localStorage.getItem("lastUpdated"));
  const [debankUnits, setDebankUnits] = useState<{ balance: number; stats: Array<{ usage: number; remains: number; date: string }> } | null>(null);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const { wallets, loading: walletsLoading } = useWallets();
  const evmWallets = wallets.filter((wallet) => wallet.chain === "evm");
  const sortedEvmWallets = [...evmWallets].sort(
    (left, right) => walletStoredValue(right) - walletStoredValue(left)
  );
  const walletsAboveMinimum = sortedEvmWallets.filter(
    (wallet) => walletStoredValue(wallet) > minimumWalletUsd
  );
  const selectedStoredValue = sortedEvmWallets
    .filter((wallet) => selectedWalletIds.includes(wallet.id))
    .reduce((sum, wallet) => sum + walletStoredValue(wallet), 0);
  const jobRunning = Boolean(activeJob && !isTerminalJob(activeJob.status));
  const refreshBusy = isLoading || jobRunning;

  const selectWalletsAboveMinimum = () => {
    localStorage.setItem("walletRefreshMinimumUsd", String(minimumWalletUsd));
    setSelectedWalletIds(walletsAboveMinimum.map((wallet) => wallet.id));
  };

  const loadDeBankUnits = useCallback(async () => {
    setUnitsLoading(true);
    try {
      const response = await apiClient.get("/debank/units");
      setDebankUnits(response.data);
    } catch {
      setDebankUnits(null);
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  const openModal = () => {
    setModalOpen(true);
    void loadDeBankUnits();
  };

  const formatLastUpdated = (timestamp: string | null) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "-";

    return isToday(date)
      ? `Today, ${format(date, "HH:mm")}`
      : formatDistanceToNow(date, { addSuffix: true });
  };

  useEffect(() => {
    if (!activeJob?.id || isTerminalJob(activeJob.status)) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await apiClient.get<{ job: RefreshJob }>(`/wallets/refetch/jobs/${activeJob.id}`);
        if (cancelled) return;
        const job = response.data.job;
        setActiveJob(job);
        if (!isTerminalJob(job.status)) return;

        setIsLoading(false);
        const failures = job.result?.results?.filter((result) => result.status === "failed") || [];
        if (job.status === "completed" || job.status === "completed_with_warnings") {
          const now = new Date().toISOString();
          setLastUpdated(now);
          localStorage.setItem("lastUpdated", now);
          window.dispatchEvent(new Event("dashboard-data-refreshed"));
          void loadDeBankUnits();
          setMessageSeverity(failures.length ? "warning" : "success");
          setMessage(
            failures.length
              ? `Refresh finished with ${failures.length} issue${failures.length === 1 ? "" : "s"}.`
              : "Refresh completed. Portfolio values are up to date."
          );
        } else {
          setMessageSeverity("error");
          setMessage(job.error || "Refresh stopped before it completed.");
        }
        setSnackbarOpen(true);
      } catch {
        if (cancelled) return;
        setIsLoading(false);
        setMessageSeverity("error");
        setMessage("Could not read refresh progress. The last good data is still shown.");
        setSnackbarOpen(true);
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeJob?.id, activeJob?.status, loadDeBankUnits]);

  const handleUpdate = useCallback(
    async (type: "all" | "evm_selected") => {
      if (jobRunning) return;
      setIsLoading(true);
      let endpoint = "/wallets/refetch";

      switch (type) {
        case "all":
          setMessageSeverity("info");
          setMessage("Refreshing all wallets...");
          break;
        case "evm_selected":
          if (!selectedWalletIds.length) {
            setMessageSeverity("warning");
            setMessage("Please select a wallet first.");
            setSnackbarOpen(true);
            setIsLoading(false);
            return;
          }
          endpoint = "/wallets/refetch/evm/batch";
          setMessageSeverity("info");
          setMessage(`Refreshing ${selectedWalletIds.length} selected EVM wallet${selectedWalletIds.length === 1 ? "" : "s"} plus all free-chain wallets...`);
          break;
        default:
          setMessageSeverity("error");
          setMessage("Invalid refresh option.");
          setSnackbarOpen(true);
          setIsLoading(false);
          return;
      }

      setSnackbarOpen(true);

      try {
        const response = await apiClient.post(endpoint, type === "evm_selected" ? { walletIds: selectedWalletIds } : undefined);
        const job = response.data?.job as RefreshJob | undefined;
        if (!job?.id) throw new Error("Refresh job was not created");
        setActiveJob(job);
        setMessageSeverity("info");
        setMessage(response.data?.message || "Refresh queued. You can follow progress here.");
      } catch (error) {
        console.error(error);
        setMessageSeverity("error");
        setMessage("Failed to refresh token data.");
      } finally {
        setIsLoading(false);
        setSnackbarOpen(true);
      }
    },
    [jobRunning, loadDeBankUnits, selectedWalletIds]
  );

  return (
    <>
      <Tooltip title="Refetch Token Data">
        <IconButton color="primary" onClick={openModal}>
          <RefreshIcon fontSize="medium" />
        </IconButton>
      </Tooltip>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Refetch Option</DialogTitle>
        <Typography sx={{ mb: 1, textAlign: "center", fontSize: 14, color: "gray" }}>
          Last Updated: {lastUpdated ? formatLastUpdated(lastUpdated) : "-"}
        </Typography>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2.5, bgcolor: "rgba(139,124,255,.06)" }}>
              <Typography variant="overline" color="text.secondary" fontWeight={800}>DEBANK API</Typography>
              {unitsLoading ? <CircularProgress size={22} sx={{ display: "block", mt: 1 }} /> : debankUnits ? <>
                <Typography variant="h5" fontWeight={760}>{debankUnits.balance.toLocaleString()} units left</Typography>
                <Typography variant="body2" color="text.secondary">
                  {Number(debankUnits.stats[0]?.usage || 0).toLocaleString()} used today
                </Typography>
              </> : <Typography color="text.secondary">Usage unavailable</Typography>}
            </Box>

            <Divider />

            {activeJob && (
              <Box sx={{ px: 1.25, py: 1.1, borderRadius: 2, bgcolor: "rgba(139,124,255,.08)", border: "1px solid rgba(139,124,255,.2)" }}>
                <Typography variant="body2" fontWeight={700}>
                  {activeJob.progress?.phase || "Refresh queued"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {typeof activeJob.progress?.total === "number" && activeJob.progress.total > 0
                    ? `${Math.min(Number(activeJob.progress.current || 0) + 1, activeJob.progress.total)} of ${activeJob.progress.total}`
                    : "Preparing a scoped refresh"}
                </Typography>
                <LinearProgress
                  sx={{ mt: 0.9 }}
                  variant={typeof activeJob.progress?.total === "number" && activeJob.progress.total > 0 ? "determinate" : "indeterminate"}
                  value={typeof activeJob.progress?.total === "number" && activeJob.progress.total > 0
                    ? (Number(activeJob.progress.current || 0) / activeJob.progress.total) * 100
                    : undefined}
                />
              </Box>
            )}

            <Button onClick={() => handleUpdate("all")} variant="contained" disabled={refreshBusy}>
              {refreshBusy ? <CircularProgress size={24} /> : "Refetch all wallets"}
            </Button>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Routine refresh skips audit-only wallets. Select them below only when you need a one-time check.
            </Typography>

            <Box sx={{ p: 1.75, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
              <Typography fontWeight={750}>Choose EVM wallets by stored value</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, mb: 1.25 }}>
                This uses the last value already stored on the Pi. Dust wallets remain available below for a manual check after receiving funds.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Minimum stored value (USD)"
                  value={minimumWalletUsd}
                  inputProps={{ min: 0, step: 1 }}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setMinimumWalletUsd(Number.isFinite(value) ? Math.max(0, value) : 0);
                  }}
                />
                <Button
                  variant="outlined"
                  sx={{ whiteSpace: "nowrap", minWidth: { sm: 190 } }}
                  onClick={selectWalletsAboveMinimum}
                  disabled={!walletsAboveMinimum.length}
                >
                  Select {walletsAboveMinimum.length} over {formatStoredValue(minimumWalletUsd)}
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" onClick={() => setSelectedWalletIds(sortedEvmWallets.map((wallet) => wallet.id))}>
                  Select all EVM
                </Button>
                <Button size="small" color="secondary" onClick={() => setSelectedWalletIds([])}>
                  Clear
                </Button>
              </Stack>
            </Box>

            {walletsLoading ? (
              <Typography textAlign="center" color="gray">
                Loading wallets...
              </Typography>
            ) : evmWallets.length > 0 ? (
              <FormControl fullWidth>
                <InputLabel id="wallet-refetch-label">Wallet</InputLabel>
                <Select
                  labelId="wallet-refetch-label"
                  label="Wallet"
                  multiple
                  value={selectedWalletIds}
                  onChange={(event) => setSelectedWalletIds((event.target.value as number[]).map(Number))}
                  renderValue={(selected) =>
                    `${selected.length} wallet${selected.length === 1 ? "" : "s"} selected · ≈${formatStoredValue(selectedStoredValue)}`
                  }
                >
                  {sortedEvmWallets.map((wallet) => (
                    <MenuItem key={wallet.id} value={wallet.id}>
                      <Checkbox checked={selectedWalletIds.includes(wallet.id)} />
                       <ListItemText
                         primary={
                           <Box display="flex" alignItems="center" justifyContent="space-between" gap={1.5}>
                             <Typography fontWeight={650} noWrap>{wallet.tag}</Typography>
                             <Typography
                               variant="body2"
                               color={walletStoredValue(wallet) > minimumWalletUsd ? "success.main" : "text.secondary"}
                               sx={{ flexShrink: 0 }}
                             >
                               ≈{formatStoredValue(walletStoredValue(wallet))}
                             </Typography>
                           </Box>
                         }
                         secondary={[
                           wallet.group_name,
                           wallet.refresh_policy === "auto" ? "routine" : "manual / audit only",
                           Number(wallet.valuation?.unpriced_asset_count || 0) > 0
                             ? `${wallet.valuation?.unpriced_asset_count} unpriced`
                             : null,
                         ].filter(Boolean).join(" · ")}
                       />
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
              onClick={() => handleUpdate("evm_selected")}
              variant="contained"
               disabled={refreshBusy || !selectedWalletIds.length}
            >
               {refreshBusy ? <CircularProgress size={24} /> : `Refetch ${selectedWalletIds.length || "selected"} EVM + free chains`}
            </Button>
            <Typography variant="caption" color="text.secondary" textAlign="center">
              Paid API usage is limited to the selected EVM wallets. Solana, Sui, Aptos, Cosmos, Hyperliquid, and static balances are always refreshed too.
            </Typography>
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
