import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, Typography } from "@mui/material";
import ThresholdSlider from "./ThresholdSlider";
import ManageWallets from "./ManageWallets"; // Import the new component
import axios from "axios";
import apiClient from "../../utils/api-client";

function SettingsDialog({ openSettings, setOpenSettings }) {
  const [hideSmallBalances, setHideSmallBalances] = useState<number>(0);

  useEffect(() => {
    if (openSettings) {
      fetchHideSmallBalances();
    }
  }, [openSettings]);

  const fetchHideSmallBalances = async () => {
    try {
      const response = await apiClient.get("/settings/hidesmallbalances");
      setHideSmallBalances(response.data.value);
    } catch (error) {
      console.error("Error fetching hideSmallBalances:", error);
    }
  };

  const updateHideSmallBalances = async (newValue: number) => {
    try {
      setHideSmallBalances(newValue);

      await apiClient.post("/settings/hidesmallbalances", {
        value: newValue,
      });
    } catch (error) {
      console.error("Error updating hideSmallBalances:", error);
    }
  };

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    updateHideSmallBalances(newValue as number);
  };

  const handleCloseSettings = () => {
    setOpenSettings(false);
  };

  return (
    <Dialog open={openSettings} onClose={handleCloseSettings} maxWidth="sm" fullWidth>
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