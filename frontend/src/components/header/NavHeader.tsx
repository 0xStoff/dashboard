import React, { useEffect, useState } from "react";
import { Box, CircularProgress, IconButton } from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import RefreshIcon from "@mui/icons-material/Refresh";
import { io } from "socket.io-client";
import { useSnackbar } from "@mui/base/useSnackbar";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { css, keyframes, styled } from "@mui/system";

const socket = io("http://localhost:3000");

const TokenDataUpdater = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleClose = () => {
    setOpen(false);
  };

  const { getRootProps, onClickAway } = useSnackbar({
    onClose: handleClose,
    open,
    autoHideDuration: 5000,
  });

  useEffect(() => {
    socket.on("progress", (data) => {

      if (data.status) {
        setMessage(data.status);
        setOpen(true);
      }

      if (data.status === "🎉 All Token Data Fetched Successfully!") {
        setIsLoading(false);
      }
    });

    return () => {
      socket.off("progress");
    };
  }, []);

  const handleUpdate = () => {
    setIsLoading(true);
    setMessage("🔄 Starting Token Data Update...");
    setOpen(true);
    socket.emit("runAllTokenDataFunctions");
  };

  return (
    <>
      <IconButton onClick={handleUpdate} color="primary" disabled={isLoading}>
        {isLoading ? <CircularProgress size={24} /> : <RefreshIcon fontSize="large" />}
      </IconButton>

      {open && (
        <ClickAwayListener onClickAway={onClickAway}>
          <CustomSnackbar {...getRootProps()}>{message}</CustomSnackbar>
        </ClickAwayListener>
      )}
    </>
  );
};

const NavHeader: React.FC<{
  isCryptoView: boolean;
  setIsCryptoView: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ isCryptoView, setIsCryptoView }) => {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
      <IconButton onClick={() => setIsCryptoView(!isCryptoView)} color="primary" sx={{ fontSize: "2rem" }}>
        {isCryptoView ? <CurrencyBitcoinIcon fontSize="large" /> : <MonetizationOnIcon fontSize="large" />}
      </IconButton>
      <TokenDataUpdater />
    </Box>
  );
};

export default NavHeader;

// Snackbar Styling
const snackbarInRight = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

const CustomSnackbar = styled("div")(
  ({ theme }) => css`
    position: fixed;
    z-index: 5500;
    display: flex;
    right: 16px;
    bottom: 16px;
    left: auto;
    justify-content: start;
    max-width: 560px;
    min-width: 300px;
    background-color: ${theme.palette.mode === "dark" ? "#1C2025" : "#fff"};
    border-radius: 8px;
    border: 1px solid ${theme.palette.mode === "dark" ? "#434D5B" : "#DAE2ED"};
    box-shadow: ${theme.palette.mode === "dark" ? `0 4px 8px rgb(0 0 0 / 0.7)` : `0 4px 8px rgb(0 0 0 / 0.1)`};
    padding: 0.75rem;
    color: ${theme.palette.mode === "dark" ? "#99CCF3" : "#007FFF"};
    font-family: "IBM Plex Sans", sans-serif;
    font-weight: 500;
    animation: ${snackbarInRight} 200ms;
    transition: transform 0.2s ease-out;
  `
);