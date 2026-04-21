import React from "react";
import { Box, Card, Chip, CircularProgress, Container, Typography } from "@mui/material";
import { toFixedString } from "../../utils/number-utils";
import { useWallets } from "../../context/WalletsContext";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";
import { Wallet } from "../../interfaces";

interface HeaderProps {
  currency: "CHF" | "$";
  totalUSDValue: number;
  selectedWalletId: string;
  setSelectedWalletId: React.Dispatch<React.SetStateAction<string>>;
}

const Header: React.FC<HeaderProps> = ({ currency, totalUSDValue, selectedWalletId, setSelectedWalletId }) => {
  const { wallets } = useWallets();
  const { rate, loading } = useUsdToChfRate();
  const displayedValue =
    currency === "CHF" ? totalUSDValue * rate : totalUSDValue;

  const visibleWallets: Array<Pick<Wallet, "id" | "tag">> = wallets.filter((wallet) => wallet.show_chip);

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
          ...visibleWallets,
        ].map((acc, i) => (
          <Chip
            key={`${acc.id}-${i}`}
            sx={{ margin: 1 }}
            onClick={() => setSelectedWalletId(String(acc.id))}
            label={acc.tag}
            variant={selectedWalletId === String(acc.id) ? "outlined" : "filled"}
          />
        ))}
      </Box>
    </Container>
  );
};

export default Header;
