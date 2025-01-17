import React, {useEffect, useState} from 'react';
import {AppBar, Toolbar, Typography, IconButton, Box} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import CurrencyBitcoinIcon from "@mui/icons-material/CurrencyBitcoin";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import RefreshIcon from "@mui/icons-material/Refresh";

const NavHeader: React.FC<{ isCryptoView: boolean; setIsCryptoView: React.Dispatch<React.SetStateAction<boolean>> }> = ({ isCryptoView, setIsCryptoView }) => {

    const [, setNextClearTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<string>('');  // Timer for next cache clear


    useEffect(() => {
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');
        const now = Date.now();

        // Check if we need to show the countdown timer
        if (cacheClears.length > 0) {
            const lastClearTime = cacheClears[cacheClears.length - 1];
            const nextClear = lastClearTime + 8 * 60 * 60 * 1000;
            setNextClearTime(nextClear);

            // Start countdown timer
            if (nextClear > now) {
                const remainingTime = nextClear - now;
                setCountdown(formatTime(remainingTime));
                const timer = setInterval(() => {
                    const newRemainingTime = nextClear - Date.now();
                    if (newRemainingTime <= 0) {
                        clearInterval(timer);
                        setCountdown('');
                    } else {
                        setCountdown(formatTime(newRemainingTime));
                    }
                }, 1000);
                return () => clearInterval(timer);
            }
        }
    }, []);


    // Helper function to format the countdown time
    const formatTime = (time: number) => {
        const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((time / (1000 * 60)) % 60);
        const seconds = Math.floor((time / 1000) % 60);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const clearCache = () => {
        const now = Date.now();
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');

        // Filter out clears older than 24 hours
        const recentClears = cacheClears.filter((clearTime: number) => now - clearTime < 24 * 60 * 60 * 1000);

        // Check if we've cleared the cache more than 3 times in the last 24 hours or in the last 8 hours
        if (recentClears.length >= 3) {
            alert("Cache can only be cleared 3 times in 24 hours.");
            return;
        }

        if (recentClears.length > 0 && now - recentClears[recentClears.length - 1] < 8 * 60 * 60 * 1000) {
            alert("Cache can only be cleared once every 8 hours.");
            return;
        }

        // Clear the cache
        localStorage.clear();
        window.location.reload();

        // Add current timestamp to cacheClears
        recentClears.push(now);
        localStorage.setItem('cacheClears', JSON.stringify(recentClears));

        // Update nextClearTime
        const nextClear = now + 8 * 60 * 60 * 1000;
        setNextClearTime(nextClear);
        setCountdown(formatTime(nextClear - now));
    };
    const toggleView = () => {
        setIsCryptoView(!isCryptoView);
    };
    return (
        <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
            <IconButton onClick={toggleView} color="primary" sx={{fontSize: '2rem'}}>
                {isCryptoView ? <CurrencyBitcoinIcon fontSize="large"/> : <MonetizationOnIcon fontSize="large"/>}
            </IconButton>
            <IconButton
                onClick={clearCache}
                color="primary"
                sx={{
                    fontSize: '2rem', opacity: countdown ? 0.3 : 1, pointerEvents: countdown ? 'none' : 'auto', // Prevent interaction if disabled
                }}
                disabled={!!countdown}
            >
                <RefreshIcon fontSize="large"/>
                <Typography variant='caption'>{countdown}</Typography>
            </IconButton>
        </Box>
    );
};

export default NavHeader;