import React, {useState} from "react";
import {AppBar, Box, IconButton, Toolbar, Typography, useMediaQuery} from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TokenDataUpdater from "./TokenDataUpdater";
import SearchInput from "./SearchInput";
import {useTheme} from "@mui/material/styles";
import {Settings} from "@mui/icons-material";
import {SettingsDialog} from "../index";
import ConnectButton from "../ConnectButton";

const NavHeader = ({
                       isCryptoView,
                       setIsCryptoView,
                       searchQuery,
                       setSearchQuery,
                       setIsAuthenticated,
                       isAuthenticated,
                       currency,
                       setCurrency
                   }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [openSettings, setOpenSettings] = useState(false)


    return (<AppBar position="sticky" sx={{background: "#121212", padding: "0 16px"}}>
        <Toolbar sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>

            {!isMobile ? <Typography variant="h5" sx={{flexGrow: 1}}>
                Pi Dashboard
            </Typography> : <Box sx={{flexGrow: 1}}></Box>}
            {isAuthenticated && <>

                {isCryptoView && <SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery}/>}

                <IconButton color="primary" onClick={() => setCurrency(c => c == 'CHF' ? '$' : 'CHF')}>
                    {currency === 'CHF' ? <Typography sx={{fontWeight: "bold", fontSize: "1rem"}}>CHF</Typography> :
                        <Typography sx={{fontWeight: "bold", fontSize: "1rem"}}>USD</Typography>}
                </IconButton>

                <IconButton color='primary' onClick={() => setOpenSettings(true)}>
                    <Settings/>
                </IconButton>


                <IconButton onClick={() => setIsCryptoView(!isCryptoView)} color="primary" sx={{fontSize: "2rem"}}>
                    {isCryptoView ? <CurrencyBitcoinIcon fontSize="large"/> : <MonetizationOnIcon fontSize="large"/>}
                </IconButton>


                <SettingsDialog
                    openSettings={openSettings}
                    setOpenSettings={setOpenSettings}
                />

                <TokenDataUpdater/>
            </>}

            <ConnectButton setIsAuthenticated={setIsAuthenticated}/>

        </Toolbar>
    </AppBar>);
};

export default NavHeader;