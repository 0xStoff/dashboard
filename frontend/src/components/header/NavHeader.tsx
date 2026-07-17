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

interface NavHeaderProps {
    isCryptoView: boolean;
    setIsCryptoView: React.Dispatch<React.SetStateAction<boolean>>;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean | null>>;
    isAuthenticated: boolean;
    currency: "CHF" | "$";
    setCurrency: React.Dispatch<React.SetStateAction<"CHF" | "$">>;
}

const NavHeader: React.FC<NavHeaderProps> = ({
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


    return (<AppBar position="sticky" elevation={0} sx={{background: "rgba(9,11,18,.78)", backdropFilter: 'blur(20px)', borderBottom: '1px solid', borderColor: 'divider', padding: {xs: "0 4px", sm: "0 20px"}}}>
        <Toolbar sx={{display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: {xs: 64, md: 72}}}>

            {!isMobile ? <Typography variant="h6" fontWeight={800} letterSpacing="-.03em" sx={{flexGrow: 1}}>
                <Box component="span" sx={{display: 'inline-grid', placeItems: 'center', width: 32, height: 32, mr: 1.25, borderRadius: '10px', background: 'linear-gradient(135deg, #8b7cff, #5de4c7)', color: '#090b12'}}>π</Box>
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

            <ConnectButton setIsAuthenticated={(auth) => setIsAuthenticated(auth)}/>

        </Toolbar>
    </AppBar>);
};

export default NavHeader;
