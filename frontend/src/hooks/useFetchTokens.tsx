import { useCallback, useMemo } from "react";
import { Token } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

interface UseFetchTokensParams {
    searchQuery: string;
    chain?: string | null;
    walletId?: string | null;
}

interface UseFetchTokensReturn {
    tokens: Token[];
    totalTokenUSD: number;
    loading: boolean;
}

export const useFetchTokens = ({
    chain = "all",
    walletId = "all",
    searchQuery,
}: UseFetchTokensParams): UseFetchTokensReturn => {
    const loadTokens = useCallback(async () => {
        const url = `/tokens?chain=${chain}&wallet_id=${walletId}&query=${searchQuery}`;
        const response = await apiClient.get<Token[]>(url);
        return response.data;
    }, [searchQuery, chain, walletId]);

    const resource = useApiResource<Token[]>({
        initialData: [],
        load: loadTokens,
        deps: [searchQuery, chain, walletId],
    });

    const totalTokenUSD = useMemo(
        () => resource.data.reduce((sum, item) => sum + item.total_usd_value, 0),
        [resource.data]
    );

    return {
        tokens: resource.data,
        totalTokenUSD,
        loading: resource.loading,
    };
};
