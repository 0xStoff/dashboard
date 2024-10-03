import React, {useEffect, useState} from 'react';
import {
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
} from '@mui/material';
import ThresholdSlider from "../../utils/ThresholdSlider";

function SettingsDialog({openSettings, setOpenSettings, hideSmallBalances, setHideSmallBalances}) {
    const [nextClearTime, setNextClearTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState<string>('');  // Timer for next cache clear


    useEffect(() => {
        const storedHideSmallBalances = localStorage.getItem('hideSmallBalances');
        const cacheClears = JSON.parse(localStorage.getItem('cacheClears') || '[]');
        const now = Date.now();

        if (storedHideSmallBalances) {
            setHideSmallBalances(JSON.parse(storedHideSmallBalances));
        }

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

    const handleSliderChange = (event: Event, newValue: number | number[]) => {
        localStorage.setItem('hideSmallBalances', JSON.stringify(newValue));
        setHideSmallBalances(newValue as number);
    };


    const handleCloseSettings = () => {
        setOpenSettings(false);
    };

    return (
        <Dialog open={openSettings} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <ThresholdSlider
                    value={hideSmallBalances}
                    onChange={handleSliderChange}
                    min={0}
                    max={300}
                    label="Hide Small Balances"
                />
                <Button onClick={clearCache} disabled={!!countdown}>Clear Local Storage</Button>
                {countdown && (<Typography variant="body2" color="textSecondary">
                    Next clear available in: {countdown}
                </Typography>)}
            </DialogContent>
        </Dialog>);
}

export default SettingsDialog;