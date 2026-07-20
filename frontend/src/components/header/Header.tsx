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
  const { rate, loading, error } = useUsdToChfRate();
  const displayedValue =
    currency === "CHF" && rate !== null ? totalUSDValue * rate : totalUSDValue;

  const visibleWallets: Array<Pick<Wallet, "id" | "tag">> = wallets.filter((wallet) => wallet.show_chip);

  return (
    <Container maxWidth={false} disableGutters>
      <Card sx={{ marginBottom: 2.5, padding: {xs: 3, md: 4}, borderRadius: 5, display: "inline-block", width: {xs: "100%", sm: "auto"}, maxWidth: "100%", overflow: "hidden", position: "relative", background: "linear-gradient(120deg, rgba(139,124,255,.14), rgba(18,21,31,.8) 48%, rgba(93,228,199,.07))" }}>
        <Box sx={{position: "absolute", width: 220, height: 220, borderRadius: "50%", bgcolor: "primary.main", filter: "blur(90px)", opacity: .12, right: -40, top: -100}} />
        <Typography variant="overline" color="text.secondary" fontWeight={750} letterSpacing={1.5}>
          Total net worth
        </Typography>
        <Typography variant="h2" sx={{fontSize: {xs: "2.5rem", md: "4rem"}, mt: .25, whiteSpace: "nowrap"}}>
          {loading && currency === "CHF" ? (
            <CircularProgress size={24} />
          ) : error && currency === "CHF" ? (
            <Typography component="span" color="error.main" fontSize="1rem">
              Exchange rate unavailable
            </Typography>
          ) : (
            `${currency} ${toFixedString(displayedValue, 0)}`
          )}
        </Typography>
      </Card>

      <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mb: 1}}>
        {[{ id: "all", tag: "all" }, ...visibleWallets].map((acc, i) => (
          <Chip
            key={`${acc.id}-${i}`}
            sx={{
              px: .5,
              bgcolor: selectedWalletId === String(acc.id) ? "rgba(139,124,255,.16)" : "rgba(255,255,255,.04)",
              borderColor: "primary.main",
            }}
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
