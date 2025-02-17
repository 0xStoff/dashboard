import { Box, Card, Chip, CircularProgress, Container, IconButton, Typography } from "@mui/material";
import React, { useState } from "react";
import { toFixedString } from "../../utils/number-utils";
import { SettingsDialog } from "../index";
import { Settings } from "@mui/icons-material";


const Header = ({ totalUSDValue, wallets, selectedItemState}) => {
  const [selectedItem, setSelectedItem] = selectedItemState;
  return <Container>
    <Card sx={{ marginY: 3, padding: 3, borderRadius: 10, width: "fit-content" }}>
      <Typography variant="h5" fontWeight="bold">
        Net Worth
      </Typography>
      <Typography variant="h2" fontWeight="bold">
        $ {toFixedString(totalUSDValue, 0)}
      </Typography>
    </Card>

    <Box>
      {[{
        id: "all", tag: "all"
      }, ...wallets.filter((wallet) => wallet.id < 14)].map((acc, i) => (<Chip
        key={`${acc.id}-${i}`}
        sx={{ margin: 1 }}
        onClick={() => setSelectedItem(acc)}
        label={acc.tag}
        variant={selectedItem?.id === acc.id ? "outlined" : "filled"}
      />))}
    </Box>
  </Container>;
};

export default Header;