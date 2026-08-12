import { useCallback } from "react";
import { NetWorthData } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useFetchNetWorth = (enabled = true) => {
  const loadNetWorth = useCallback(async () => {
    const response = await apiClient.get<NetWorthData[]>("/net-worth?range=ALL");
    return response.data;
  }, []);

  const resource = useApiResource<NetWorthData[]>({
    enabled,
    initialData: [],
    load: loadNetWorth,
  });

  return {
    netWorth: resource.data,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
};
