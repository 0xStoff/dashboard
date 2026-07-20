import React, { useMemo } from "react";
import {
    ArrowOutward,
    HubOutlined,
    InsightsOutlined,
    PieChartOutline,
    TrendingDown,
    TrendingUp,
} from "@mui/icons-material";
import { Box, Card, Chip, Typography } from "@mui/material";
import { Chain, Token } from "../../interfaces";
import { formatNumber, toFixedString } from "../../utils/number-utils";

interface PortfolioInsightsProps {
    chains: Chain[];
    tokens: Token[];
    totalProtocolUSD: number;
    totalTokenUSD: number;
    onSelectChain: (chainId: string) => void;
    onSelectToken: (token: Token) => void;
}

const valueOf = (token: Token) => Number(token.total_usd_value) || token.amount * token.price || 0;

const InsightCard: React.FC<{
    eyebrow: string;
    title: string;
    detail: string;
    icon: React.ReactNode;
    accent?: string;
    onClick?: () => void;
}> = ({ eyebrow, title, detail, icon, accent = "primary.main", onClick }) => (
    <Card
        onClick={onClick}
        sx={{
            p: 2.25,
            minWidth: 0,
            cursor: onClick ? "pointer" : "default",
            position: "relative",
            overflow: "hidden",
            transition: "transform .2s ease, border-color .2s ease, background-color .2s ease",
            "&:hover": onClick
                ? {
                      transform: "translateY(-2px)",
                      borderColor: "rgba(139,124,255,.38)",
                      bgcolor: "rgba(139,124,255,.045)",
                  }
                : undefined,
        }}
    >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
            <Box minWidth={0}>
                <Typography variant="overline" color="text.secondary" fontWeight={750} letterSpacing={1}>
                    {eyebrow}
                </Typography>
                <Typography variant="h6" fontWeight={750} noWrap mt={0.15}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap mt={0.35}>
                    {detail}
                </Typography>
            </Box>
            <Box
                sx={{
                    width: 38,
                    height: 38,
                    flex: "0 0 auto",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2.5,
                    color: accent,
                    bgcolor: "rgba(139,124,255,.09)",
                }}
            >
                {icon}
            </Box>
        </Box>
        {onClick && (
            <ArrowOutward
                sx={{ position: "absolute", right: 10, bottom: 9, fontSize: 15, color: "text.disabled" }}
            />
        )}
    </Card>
);

const PortfolioInsights: React.FC<PortfolioInsightsProps> = ({
    chains,
    tokens,
    totalProtocolUSD,
    totalTokenUSD,
    onSelectChain,
    onSelectToken,
}) => {
    const insights = useMemo(() => {
        const sortedTokens = [...tokens].sort((a, b) => valueOf(b) - valueOf(a));
        const topToken = sortedTokens[0] || null;
        const largestMover =
            [...tokens]
                .filter((token) => Number.isFinite(Number(token.price_24h_change)))
                .sort(
                    (a, b) =>
                        Math.abs(Number(b.price_24h_change)) - Math.abs(Number(a.price_24h_change))
                )[0] || null;
        const topChain =
            [...chains].sort((a, b) => Number(b.usd_value || 0) - Number(a.usd_value || 0))[0] || null;
        const total = totalTokenUSD + totalProtocolUSD;

        return {
            largestMover,
            topChain,
            topToken,
            tokenShare: total > 0 ? (totalTokenUSD / total) * 100 : 0,
            topTokenShare: total > 0 && topToken ? (valueOf(topToken) / total) * 100 : 0,
        };
    }, [chains, tokens, totalProtocolUSD, totalTokenUSD]);

    if (!tokens.length && !chains.length) return null;

    const movement = Number(insights.largestMover?.price_24h_change) || 0;
    const MovementIcon = movement >= 0 ? TrendingUp : TrendingDown;

    return (
        <Box sx={{ my: 2.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.25 }}>
                <Box>
                    <Typography variant="h5">Portfolio pulse</Typography>
                    <Typography variant="body2" color="text.secondary">
                        A quick read on allocation, concentration and movement
                    </Typography>
                </Box>
                <Chip
                    icon={<InsightsOutlined />}
                    label={`${tokens.length} assets · ${chains.length} networks`}
                    size="small"
                    variant="outlined"
                    sx={{ display: { xs: "none", sm: "flex" } }}
                />
            </Box>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
                    gap: 1.5,
                }}
            >
                <Card sx={{ p: 2.25 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Box>
                            <Typography variant="overline" color="text.secondary" fontWeight={750} letterSpacing={1}>
                                ALLOCATION
                            </Typography>
                            <Typography variant="h6" fontWeight={750} mt={0.15}>
                                {toFixedString(insights.tokenShare, 0)}% liquid
                            </Typography>
                        </Box>
                        <PieChartOutline color="primary" />
                    </Box>
                    <Box sx={{ display: "flex", height: 7, borderRadius: 10, overflow: "hidden", mt: 1.25, mb: 0.8 }}>
                        <Box sx={{ width: `${insights.tokenShare}%`, bgcolor: "primary.main" }} />
                        <Box sx={{ flex: 1, bgcolor: "secondary.main" }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        ${formatNumber(totalTokenUSD, "axis")} tokens · ${formatNumber(totalProtocolUSD, "axis")} DeFi
                    </Typography>
                </Card>

                {insights.topToken && (
                    <InsightCard
                        eyebrow="LARGEST POSITION"
                        title={insights.topToken.symbol}
                        detail={`$${formatNumber(valueOf(insights.topToken), "axis")} · ${toFixedString(insights.topTokenShare, 1)}% of portfolio`}
                        icon={<HubOutlined />}
                        onClick={() => onSelectToken(insights.topToken as Token)}
                    />
                )}

                {insights.largestMover && (
                    <InsightCard
                        eyebrow="24H MOVEMENT"
                        title={`${movement >= 0 ? "+" : ""}${toFixedString(movement, 2)}% ${insights.largestMover.symbol}`}
                        detail="Largest absolute move in your assets"
                        icon={<MovementIcon />}
                        accent={movement >= 0 ? "success.main" : "error.main"}
                        onClick={() => onSelectToken(insights.largestMover as Token)}
                    />
                )}

                {insights.topChain && (
                    <InsightCard
                        eyebrow="LEADING NETWORK"
                        title={insights.topChain.name}
                        detail={`$${formatNumber(Number(insights.topChain.usd_value), "axis")} tracked value`}
                        icon={<ArrowOutward />}
                        onClick={() => onSelectChain(insights.topChain?.chain_id || "all")}
                    />
                )}
            </Box>
        </Box>
    );
};

export default React.memo(PortfolioInsights);
