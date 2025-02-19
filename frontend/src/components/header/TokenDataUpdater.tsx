import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { io } from "socket.io-client";
import Snackbar from "../utils/Snackbar";

const socket = io(process.env.REACT_APP_BASE_URL);

const TokenDataUpdater = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const handleProgress = (data) => {
      if (isMounted.current) {
        if (data.status) {
          setMessage(data.status);
          setOpen(true);
        }

        if (data.status === "🎉 All Token Data Fetched Successfully!") {
          setIsLoading(false);
        }
      }
    };

    socket.on("progress", handleProgress);

    return () => {
      isMounted.current = false;
      socket.off("progress", handleProgress);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (isMounted.current) {
      setIsLoading(true);
      localStorage.clear();
      setMessage("🔄 Starting Token Data Update...");
      setOpen(true);
      socket.emit("runAllTokenDataFunctions");
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