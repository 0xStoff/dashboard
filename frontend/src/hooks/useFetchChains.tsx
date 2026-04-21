import { useCallback, useMemo } from "react";
import { Chain } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useFetchChains = (walletId: string | null = "all", searchQuery: string) => {
  const loadChains = useCallback(async () => {
    const url = `/chains?wallet_id=${walletId}&query=${searchQuery}`;
    const response = await apiClient.get<Chain[]>(url);
    return response.data;
  }, [walletId, searchQuery]);

  const resource = useApiResource<Chain[]>({
    initialData: [],
    load: loadChains,
    deps: [walletId, searchQuery],
  });

  return useMemo(
    () => ({
      chains: resource.data,
      loading: resource.loading,
      error: resource.error,
      reload: resource.reload,
    }),
    [resource.data, resource.error, resource.loading, resource.reload]
  );
};
