import { useMemo } from "react";
import { Chain, Protocol, Token } from "../interfaces";
import { useWallets } from "../context/WalletsContext";
import { useFetchNetWorth } from "./useFetchNetWorth";
import { useDashboardSettings } from "../context/DashboardSettingsContext";
import { usePortfolioSnapshot } from "./usePortfolioSnapshot";

const MIN_HIDDEN_ASSET_USD = 0.1;

interface UseDashboardDataParams {
    walletId: string;
    selectedChainId: string;
    searchQuery: string;
    enabled?: boolean;
}

export const useDashboardData = ({
    walletId,
    selectedChainId,
    searchQuery,
    enabled = true,
}: UseDashboardDataParams) => {
    const walletResource = useWallets();
    const { settings } = useDashboardSettings();
    const snapshotResource = usePortfolioSnapshot({
        chain: selectedChainId,
        walletId,
        searchQuery,
        enabled,
    });
    const netWorthResource = useFetchNetWorth(enabled);

    const hiddenAssetTokens = useMemo(
        () =>
            snapshotResource.data.assets.filter(
                (token) => {
                    const value = Number(token.total_usd_value || 0);
                    return value >= MIN_HIDDEN_ASSET_USD && value <= settings.hideSmallAssetBalances;
                }
            ),
        [settings.hideSmallAssetBalances, snapshotResource.data.assets]
    );
    const visibleTokens = useMemo(
        () =>
            snapshotResource.data.assets.filter(
                (token) => Number(token.total_usd_value || 0) > settings.hideSmallAssetBalances
            ),
        [settings.hideSmallAssetBalances, snapshotResource.data.assets]
    );
    const visibleProtocols = useMemo(
        () =>
            snapshotResource.data.protocols.filter(
                (protocol) => Number(protocol.totalUSD || 0) > settings.hideSmallProtocolBalances
            ),
        [snapshotResource.data.protocols, settings.hideSmallProtocolBalances]
    );
    const visibleChains = useMemo(
        () =>
            snapshotResource.data.chains.filter(
                (chain) => Number(chain.usd_value || 0) > settings.hideSmallNetworkBalances
            ),
        [snapshotResource.data.chains, settings.hideSmallNetworkBalances]
    );

    return {
        chains: visibleChains as Chain[],
        loading:
            walletResource.loading ||
            snapshotResource.loading,
        hiddenAssetTokens: hiddenAssetTokens as Token[],
        netWorth: netWorthResource.netWorth,
        protocolsTable: visibleProtocols as Protocol[],
        tokens: visibleTokens as Token[],
        totalProtocolUSD: snapshotResource.data.totals.protocolUsd,
        totalTokenUSD: snapshotResource.data.totals.tokenUsd,
        totalUSDValue: snapshotResource.data.totals.totalUsd,
        portfolioSnapshot: snapshotResource.data,
        wallets: walletResource.wallets,
    };
};
