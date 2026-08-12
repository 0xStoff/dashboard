import { useCallback } from "react";
import { AssetHistoryData, Token } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useFetchAssetHistory = (selectedToken: Token | null) => {
  const loadHistory = useCallback(async () => {
    if (!selectedToken) return [];

    const parameters = new URLSearchParams({
      range: "ALL",
      type: selectedToken.chain_id === "protocol" ? "protocol" : "token",
    });
    if (selectedToken.chain_id === "protocol") {
      parameters.set("name", selectedToken.name);
    } else {
      parameters.set("symbol", selectedToken.symbol);
      parameters.set("chain", selectedToken.chain_id);
      if (selectedToken.contract_address) {
        parameters.set("contract", selectedToken.contract_address);
      }
    }

    const response = await apiClient.get<AssetHistoryData[]>(
      `/net-worth/assets?${parameters.toString()}`
    );
    return response.data;
  }, [selectedToken]);

  const resource = useApiResource<AssetHistoryData[]>({
    enabled: Boolean(selectedToken),
    initialData: [],
    load: loadHistory,
    deps: [selectedToken?.chain_id, selectedToken?.name, selectedToken?.symbol],
  });

  return {
    history: resource.data,
    loading: resource.loading,
    error: resource.error,
  };
};
