import { Chain, Protocol, Token } from "../interfaces";
import { useWallets } from "../context/WalletsContext";
import { useFetchChains } from "./useFetchChains";
import { useFetchNetWorth } from "./useFetchNetWorth";
import { useFetchProtocolsTable } from "./useFetchProtocolsTable";
import { useFetchTokens } from "./useFetchTokens";

interface UseDashboardDataParams {
    walletId: string;
    selectedChainId: string;
    searchQuery: string;
}

export const useDashboardData = ({
    walletId,
    selectedChainId,
    searchQuery,
}: UseDashboardDataParams) => {
    const walletResource = useWallets();
    const chainResource = useFetchChains(walletId, searchQuery);
    const tokenResource = useFetchTokens({
        chain: selectedChainId,
        walletId,
        searchQuery,
    });
    const protocolResource = useFetchProtocolsTable(selectedChainId, walletId, searchQuery);
    const netWorthResource = useFetchNetWorth({ latest: false, includeDetails: true });

    const totalUSDValue = tokenResource.totalTokenUSD + protocolResource.totalProtocolUSD;

    return {
        chains: chainResource.chains as Chain[],
        loading:
            walletResource.loading ||
            chainResource.loading ||
            tokenResource.loading ||
            protocolResource.loading,
        netWorth: netWorthResource.netWorth,
        protocolsTable: protocolResource.protocolsTable as Protocol[],
        saveNetWorth: netWorthResource.saveNetWorth,
        tokens: tokenResource.tokens as Token[],
        totalProtocolUSD: protocolResource.totalProtocolUSD,
        totalTokenUSD: tokenResource.totalTokenUSD,
        totalUSDValue,
        wallets: walletResource.wallets,
    };
};
