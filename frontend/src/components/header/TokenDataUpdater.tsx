import React, { useCallback, useState } from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import Snackbar from "../utils/Snackbar";

const TokenDataUpdater = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdate = useCallback(async () => {
    setIsLoading(true);
    localStorage.clear();
    setMessage("🔄 Starting Token Data Update...");
    setOpen(true);

    try {
      const response = await fetch("/api/wallets/refetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to update token data.");
      }

      const result = await response.json();
      setMessage(result.message || "🎉 All Token Data Fetched Successfully!");
    } catch (error) {
      setMessage("❌ Error fetching token data.");
    } finally {
      setIsLoading(false);
      setOpen(true);
    }
  }, []);

  return (
      <>
        <Tooltip title="Update Token Data" arrow>
          <IconButton onClick={handleUpdate} color="primary" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : <RefreshIcon fontSize="large" />}
          </IconButton>
        </Tooltip>

        <Snackbar open={open} message={message} handleClose={() => setOpen(false)} />
      </>
  );
};

export default TokenDataUpdater;