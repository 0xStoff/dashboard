import React from "react";
import { Box, Card, Chip, CircularProgress, Container, Typography } from "@mui/material";
import { toFixedString } from "../../utils/number-utils";
import { useWallets } from "../../context/WalletsContext";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";

const Header = ({ currency, totalUSDValue, selectedItemState }) => {
  const [selectedItem, setSelectedItem] = selectedItemState;
  const { wallets } = useWallets();
  const { rate, loading } = useUsdToChfRate();
  const displayedValue =
    currency === "CHF" ? totalUSDValue * rate : totalUSDValue;

  return (
    <Container>
      <Card sx={{ marginY: 3, padding: 3, borderRadius: 10, width: "fit-content" }}>
        <Typography variant="h5" fontWeight="bold">
          Net Worth
        </Typography>
        <Typography variant="h2" fontWeight="bold">
          {loading && currency === "CHF" ? (
            <CircularProgress size={24} />
          ) : (
            `${currency} ${toFixedString(displayedValue, 0)}`
          )}
        </Typography>
      </Card>

      <Box>
        {[
          { id: "all", tag: "all" },
          ...wallets.filter((acc) => acc.show_chip)
        ].map((acc, i) => (
          <Chip
            key={`${acc.id}-${i}`}
            sx={{ margin: 1 }}
            onClick={() => setSelectedItem(acc)}
            label={acc.tag}
            variant={selectedItem?.id === acc.id ? "outlined" : "filled"}
          />
        ))}
      </Box>
    </Container>
  );
};

export default Header;