import React from "react";
import { Avatar, Box, ButtonBase, Card, Typography } from "@mui/material";
import { Chain } from "../../interfaces";
import { buildLogoUrl } from "../../config/env";
import { formatNumber } from "../../utils/number-utils";

const ChainList: React.FC<{
  chains: Chain[];
  chainIdState: [string, React.Dispatch<React.SetStateAction<string>>];
  conversionRate?: number;
  currencyLabel?: string;
}> = ({ chains, chainIdState, conversionRate = 1, currencyLabel = "$" }) => {
  const [selectedChainId, setSelectedChainId] = chainIdState;

  if (!chains.length) return null;

  const selectChain = (chainId: string) => {
    setSelectedChainId(chainId === "all" || selectedChainId === chainId ? "all" : chainId);
  };

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2 }, my: { xs: 2, md: 2.5 }, width: "100%", borderRadius: "16px", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.25 }}>
        <Typography variant="subtitle1" fontWeight={800}>Networks</Typography>
        <Typography variant="caption" color="text.secondary">Filter assets and protocols</Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(auto-fit, minmax(150px, 1fr))" },
          gap: 1,
        }}
      >
        <ButtonBase
          onClick={() => selectChain("all")}
          aria-pressed={selectedChainId === "all"}
          sx={{ minHeight: 48, px: 1.5, justifyContent: "center", borderRadius: "12px", border: "1px solid", borderColor: selectedChainId === "all" ? "primary.main" : "divider", bgcolor: selectedChainId === "all" ? "rgba(139,124,255,.14)" : "transparent" }}
        >
          <Typography variant="body2" fontWeight={750}>All networks</Typography>
        </ButtonBase>
        {chains.map((chain) => {
          const active = selectedChainId === chain.chain_id;
          return (
            <ButtonBase
              key={chain.chain_id}
              onClick={() => selectChain(chain.chain_id)}
              aria-pressed={active}
              sx={{ minWidth: 0, minHeight: 48, display: "flex", justifyContent: "flex-start", gap: 1, px: 1.25, borderRadius: "12px", border: "1px solid", borderColor: active ? "primary.main" : "transparent", bgcolor: active ? "rgba(139,124,255,.14)" : "transparent", "&:hover": { bgcolor: active ? "rgba(139,124,255,.18)" : "rgba(255,255,255,.045)" } }}
            >
              <Avatar alt={chain.name} src={buildLogoUrl(chain.logo_path)} sx={{ width: 26, height: 26 }} />
              <Box minWidth={0} textAlign="left">
                <Typography variant="body2" fontWeight={700} noWrap>{chain.name}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>{currencyLabel} {formatNumber(Number(chain.usd_value) * conversionRate, "axis")}</Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Card>
  );
};

export default ChainList;
