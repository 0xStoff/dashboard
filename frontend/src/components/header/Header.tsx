import React from "react";
import { Box, Button, Card, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { AccountBalanceWalletOutlined, AccountTreeOutlined, ShowChartRounded } from "@mui/icons-material";
import { toFixedString } from "../../utils/number-utils";
import { useWallets } from "../../context/WalletsContext";
import { useUsdToChfRate } from "../../hooks/useUsdToChfRate";
import { Wallet } from "../../interfaces";

interface HeaderProps {
  currency: "CHF" | "$";
  totalUSDValue: number;
  totalTokenUSD: number;
  totalProtocolUSD: number;
  protocolCount: number;
  selectedWalletId: string;
  setSelectedWalletId: React.Dispatch<React.SetStateAction<string>>;
  history?: Array<unknown>;
  showHistory?: boolean;
  onToggleHistory?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  currency,
  totalUSDValue,
  totalTokenUSD,
  totalProtocolUSD,
  protocolCount,
  selectedWalletId,
  setSelectedWalletId,
  history = [],
  showHistory = false,
  onToggleHistory,
}) => {
  const { wallets } = useWallets();
  const { rate, loading } = useUsdToChfRate();
  const displayedValue =
    currency === "CHF" ? totalUSDValue * rate : totalUSDValue;
  const displayUsd = (value: number) =>
    `${currency} ${toFixedString(currency === "CHF" ? value * rate : value, 0)}`;

  const visibleWallets: Array<Pick<Wallet, "id" | "tag">> = wallets.filter((wallet) => wallet.show_chip);

  return (
    <Card sx={{ my: { xs: 2, md: 3 }, p: { xs: 2, sm: 2.5 }, borderRadius: "18px", background: "linear-gradient(120deg, #171d30 0%, #111522 62%, #10121b 100%)" }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={{ xs: 2, lg: 3 }} alignItems={{ lg: "center" }}>
        <Box sx={{ minWidth: { lg: 290 }, flex: 1 }}>
          <Typography variant="overline" color="primary.light" fontWeight={800} letterSpacing=".08em">Portfolio value</Typography>
          <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap">
            <Typography variant="h3" fontWeight={800} letterSpacing="-0.045em" lineHeight={1.05}>
              {loading && currency === "CHF" ? <CircularProgress size={28} /> : `${currency} ${toFixedString(displayedValue, 0)}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">wallet + deployed</Typography>
          </Stack>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(118px, 1fr))",
            gap: { xs: 1.5, sm: 2.5 },
            flexShrink: 0,
            "& > :first-of-type": { pr: { sm: 2.5 }, borderRight: { sm: "1px solid" }, borderColor: "divider" },
          }}
        >
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccountBalanceWalletOutlined color="primary" fontSize="small" />
              <Typography variant="caption" color="text.secondary">In wallets</Typography>
            </Stack>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 0.35 }}>{displayUsd(totalTokenUSD)}</Typography>
          </Box>
          <Box>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccountTreeOutlined color="success" fontSize="small" />
              <Typography variant="caption" color="text.secondary">Deployed</Typography>
            </Stack>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 0.35 }}>{displayUsd(totalProtocolUSD)}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">{protocolCount} protocols</Typography>
          </Box>
        </Box>

        {onToggleHistory && (
          <Button sx={{ alignSelf: { xs: "flex-start", lg: "center" }, whiteSpace: "nowrap" }} size="small" variant={showHistory ? "contained" : "outlined"} startIcon={<ShowChartRounded />} onClick={onToggleHistory}>
            {showHistory ? "Hide history" : "History"}
          </Button>
        )}
      </Stack>
      {!history.length && <Typography sx={{ mt: 1 }} variant="caption" color="text.secondary">History will appear after snapshots load.</Typography>}

      <Divider sx={{ my: 1.75 }} />
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.25}>
        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: "uppercase", letterSpacing: ".06em", minWidth: 72 }}>Wallet view</Typography>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {[{ id: "all", tag: "All wallets" }, ...visibleWallets].map((acc, i) => (
            <Chip key={`${acc.id}-${i}`} size="small" onClick={() => setSelectedWalletId(String(acc.id))} label={acc.tag} variant={selectedWalletId === String(acc.id) ? "outlined" : "filled"} sx={{ borderRadius: 1.5, fontWeight: 700 }} />
          ))}
        </Box>
      </Stack>
    </Card>
  );
};

export default Header;
