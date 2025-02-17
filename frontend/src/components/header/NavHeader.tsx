import React, { useState } from "react";
import { AppBar, Box, IconButton, Toolbar, Typography, useMediaQuery } from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import TokenDataUpdater from "./TokenDataUpdater";
import SearchInput from "./SearchInput"; 
import { useTheme } from "@mui/material/styles";
import { Settings } from "@mui/icons-material";
import { SettingsDialog } from "../index";

const NavHeader = ({ isCryptoView, setIsCryptoView, searchQuery, setSearchQuery }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [openSettings, setOpenSettings] = useState(false)

  return (
    <AppBar position="sticky" sx={{ background: "#121212", padding: "0 16px" }}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {!isMobile ? <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Dashboard
        </Typography> : <Box sx={{flexGrow: 1}}></Box>}

        {isCryptoView && <SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}

        <IconButton color='primary' onClick={() => setOpenSettings(true)}>
          <Settings />
        </IconButton>

        <IconButton onClick={() => setIsCryptoView(!isCryptoView)} color="primary" sx={{ fontSize: "2rem" }}>
          {isCryptoView ? <CurrencyBitcoinIcon fontSize="large" /> : <MonetizationOnIcon fontSize="large" />}
        </IconButton>



        <SettingsDialog
          openSettings={openSettings}
          setOpenSettings={setOpenSettings}
        />

        <TokenDataUpdater />
      </Toolbar>
    </AppBar>
  );
};

export default NavHeader;