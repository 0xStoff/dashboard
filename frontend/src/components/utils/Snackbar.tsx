import React from "react";
import { useSnackbar } from "@mui/base/useSnackbar";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { css, keyframes, styled } from "@mui/system";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const Snackbar = ({ open, message, handleClose }) => {
  const { getRootProps } = useSnackbar({
    onClose: handleClose,
    open,
  });

  return open ? (
      <ClickAwayListener onClickAway={() => {}}>
        <CustomSnackbar {...getRootProps()}>
          {message}
          <IconButton onClick={handleClose} size="small" sx={{ marginLeft: "auto", color: "inherit" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </CustomSnackbar>
      </ClickAwayListener>
  ) : null;
};

export default Snackbar;


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