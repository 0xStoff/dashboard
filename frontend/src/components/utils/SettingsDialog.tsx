import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent } from "@mui/material";
import ThresholdSlider from "./ThresholdSlider";
import ManageWallets from "./ManageWallets";
import apiClient from "../../utils/api-client";

interface SettingsDialogProps {
    openSettings: boolean;
    setOpenSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

function SettingsDialog({ openSettings, setOpenSettings }: SettingsDialogProps) {
    const [hideSmallBalances, setHideSmallBalances] = useState(0);

    const fetchHideSmallBalances = useCallback(async () => {
        try {
            const response = await apiClient.get<{ value: number }>("/settings/hidesmallbalances");
            setHideSmallBalances(Number(response.data.value) || 0);
        } catch (error) {
            console.error("Error fetching hideSmallBalances:", error);
        }
    }, []);

    const updateHideSmallBalances = useCallback(async (newValue: number) => {
        try {
            setHideSmallBalances(newValue);
            await apiClient.post("/settings/hidesmallbalances", { value: newValue });
        } catch (error) {
            console.error("Error updating hideSmallBalances:", error);
        }
    }, []);

    useEffect(() => {
        if (!openSettings) {
            return;
        }

        fetchHideSmallBalances();
    }, [fetchHideSmallBalances, openSettings]);

    const handleSliderChange = (_event: Event, newValue: number | number[]) => {
        updateHideSmallBalances(Number(newValue));
    };

    return (
        <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="sm" fullWidth>
            <DialogContent>
                <ThresholdSlider
                    value={hideSmallBalances}
                    onChange={handleSliderChange}
                    min={0}
                    max={300}
                    label="Hide Small Balances"
                />
                <ManageWallets />
            </DialogContent>
        </Dialog>
    );
}

export default SettingsDialog;
