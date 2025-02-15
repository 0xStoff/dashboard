import React from "react";
import { AppBar, Box, IconButton, Toolbar, Typography, useMediaQuery } from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import TokenDataUpdater from "./TokenDataUpdater";
import SearchInput from "./SearchInput"; 
import { useTheme } from "@mui/material/styles";

const NavHeader = ({ isCryptoView, setIsCryptoView, searchQuery, setSearchQuery }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <AppBar position="sticky" sx={{ background: "#121212", padding: "0 16px" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {!isMobile ? <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Dashboard
        </Typography> : <Box sx={{flexGrow: 1}}></Box>}

        {isCryptoView && <SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        <IconButton onClick={() => setIsCryptoView(!isCryptoView)} color="primary" sx={{ fontSize: "2rem" }}>
          {isCryptoView ? <CurrencyBitcoinIcon fontSize="large" /> : <MonetizationOnIcon fontSize="large" />}
        </IconButton>

        {/* Token Data Updater */}
        <TokenDataUpdater />
      </Toolbar>
    </AppBar>
  );
};

export default NavHeader;