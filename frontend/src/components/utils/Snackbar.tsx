import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  IconButton,
  Snackbar as MuiSnackbar,
} from "@mui/material";
import type { AlertColor, SnackbarCloseReason } from "@mui/material";

interface SnackbarProps {
  open: boolean;
  message: string;
  handleClose: () => void;
  severity?: AlertColor;
}

const Snackbar = ({
  open,
  message,
  handleClose,
  severity = "success",
}: SnackbarProps) => {
  const handleSnackbarClose = (
    _event: Event | React.SyntheticEvent,
    reason?: SnackbarCloseReason
  ) => {
    if (reason !== "clickaway") {
      handleClose();
    }
  };

  return (
    <MuiSnackbar
      open={open}
      autoHideDuration={5000}
      onClose={handleSnackbarClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        right: { xs: 16, sm: 24 },
        bottom: { xs: 16, sm: 24 },
        left: { xs: 16, sm: "auto" },
      }}
    >
      <Alert
        severity={severity}
        variant="outlined"
        action={
          <IconButton
            aria-label="Close notification"
            color="inherit"
            size="small"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          width: "100%",
          minWidth: { sm: 360 },
          maxWidth: 520,
          alignItems: "center",
          borderRadius: 3.5,
          borderColor: "rgba(139, 124, 255, 0.28)",
          background:
            "linear-gradient(135deg, rgba(139,124,255,.14), rgba(18,21,31,.94) 48%, rgba(93,228,199,.07))",
          backdropFilter: "blur(18px)",
          boxShadow: "0 18px 55px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.06)",
          color: "text.primary",
          fontSize: "0.95rem",
          fontWeight: 650,
          letterSpacing: "-0.01em",
          py: 0.75,
          px: 1,
          "& .MuiAlert-icon": {
            color: severity === "error" ? "error.main" : "secondary.main",
            opacity: 1,
          },
          "& .MuiAlert-message": {
            py: 0.75,
          },
          "& .MuiAlert-action": {
            alignItems: "center",
            pl: 2,
            pr: 0.25,
            py: 0,
          },
        }}
      >
        {message}
      </Alert>
    </MuiSnackbar>
  );
};

export default Snackbar;
