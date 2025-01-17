import React, {useEffect, useState} from 'react';
import {
    Button, Dialog, DialogTitle, DialogContent, Typography,
} from '@mui/material';
import ThresholdSlider from "../../utils/ThresholdSlider";

function SettingsDialog({openSettings, setOpenSettings, hideSmallBalances, setHideSmallBalances}) {


    useEffect(() => {
        const storedHideSmallBalances = localStorage.getItem('hideSmallBalances');

        if (storedHideSmallBalances) {
            setHideSmallBalances(JSON.parse(storedHideSmallBalances));
        }

    }, []);


    const handleSliderChange = (event: Event, newValue: number | number[]) => {
        localStorage.setItem('hideSmallBalances', JSON.stringify(newValue));
        setHideSmallBalances(newValue as number);
    };


    const handleCloseSettings = () => {
        setOpenSettings(false);
    };

    return (<Dialog open={openSettings} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent>
            <ThresholdSlider
                value={hideSmallBalances}
                onChange={handleSliderChange}
                min={0}
                max={300}
                label="Hide Small Balances"
            />
        </DialogContent>
    </Dialog>);
}

export default SettingsDialog;