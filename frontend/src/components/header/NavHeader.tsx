import React, {useState} from "react";
import {AppBar, Avatar, Box, IconButton, Toolbar, Tooltip, Typography, useMediaQuery} from "@mui/material";
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TokenDataUpdater from "./TokenDataUpdater";
import SearchInput from "./SearchInput";
import {useTheme} from "@mui/material/styles";
import {Settings} from "@mui/icons-material";
import RadarIcon from "@mui/icons-material/Radar";
import {SettingsDialog} from "../index";
import ConnectButton from "../ConnectButton";
import { buildLogoUrl } from "../../config/env";

interface NavHeaderProps {
    isCryptoView: boolean;
    setIsCryptoView: React.Dispatch<React.SetStateAction<boolean>>;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean | null>>;
    isAuthenticated: boolean;
    currency: "CHF" | "$";
    setCurrency: React.Dispatch<React.SetStateAction<"CHF" | "$">>;
    showRobinhoodDashboard: boolean;
    setShowRobinhoodDashboard: React.Dispatch<React.SetStateAction<boolean>>;
    showPoolRadar: boolean;
    setShowPoolRadar: React.Dispatch<React.SetStateAction<boolean>>;
}

const NavHeader: React.FC<NavHeaderProps> = ({
                       isCryptoView,
                       setIsCryptoView,
                       searchQuery,
                       setSearchQuery,
                       setIsAuthenticated,
                       isAuthenticated,
                       currency,
                       setCurrency,
                       showRobinhoodDashboard,
                       setShowRobinhoodDashboard,
                       showPoolRadar,
                       setShowPoolRadar
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

                <Tooltip title={showRobinhoodDashboard ? "Robinhood portfolio open" : "Open Robinhood portfolio"}>
                    <IconButton
                        aria-label="Open Robinhood portfolio"
                        color={showRobinhoodDashboard ? "secondary" : "primary"}
                        onClick={() => {
                            setIsCryptoView(true);
                            setShowPoolRadar(false);
                            setShowRobinhoodDashboard((open) => !open);
                            const url = new URL(window.location.href);
                            url.searchParams.delete("view");
                            window.history.replaceState({}, "", url);
                        }}
                    >
                        <Avatar alt="Robinhood" src={buildLogoUrl("/logos/hood.png")} sx={{ width: 24, height: 24, bgcolor: "primary.main" }}>R</Avatar>
                    </IconButton>
                </Tooltip>

                <Tooltip title={showPoolRadar ? "Pool Radar open" : "Open ETH / USDG Pool Radar"}>
                    <IconButton
                        aria-label="Open ETH / USDG Pool Radar"
                        color={showPoolRadar ? "secondary" : "primary"}
                        onClick={() => {
                            setIsCryptoView(true);
                            setShowRobinhoodDashboard(false);
                            setShowPoolRadar((open) => !open);
                            const url = new URL(window.location.href);
                            if (showPoolRadar) url.searchParams.delete("view");
                            else url.searchParams.set("view", "pool-radar");
                            window.history.replaceState({}, "", url);
                        }}
                    >
                        <RadarIcon />
                    </IconButton>
                </Tooltip>


                <IconButton onClick={() => {
                    if (showPoolRadar) {
                        setShowPoolRadar(false);
                        setIsCryptoView(true);
                        const url = new URL(window.location.href);
                        url.searchParams.delete("view");
                        window.history.replaceState({}, "", url);
                        return;
                    }
                    if (showRobinhoodDashboard) {
                        setShowRobinhoodDashboard(false);
                        setIsCryptoView(true);
                        return;
                    }
                    setIsCryptoView(!isCryptoView);
                }} color="primary" sx={{fontSize: "2rem"}}>
                    {isCryptoView ? <CurrencyBitcoinIcon fontSize="large"/> : <MonetizationOnIcon fontSize="large"/>}
                </IconButton>


                <SettingsDialog
                    openSettings={openSettings}
                    setOpenSettings={setOpenSettings}
                />

                <TokenDataUpdater/>
            </>}

            <ConnectButton setIsAuthenticated={(auth) => setIsAuthenticated(auth)}/>

        </Toolbar>
    </AppBar>);
};

export default NavHeader;
