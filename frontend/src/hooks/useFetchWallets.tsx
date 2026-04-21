import { useCallback } from "react";
import { Wallet } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

export const useFetchWallets = () => {
  const loadWallets = useCallback(async () => {
    const response = await apiClient.get<Wallet[]>("/wallets");
    return response.data;
  }, []);

  const resource = useApiResource<Wallet[]>({
    initialData: [],
    load: loadWallets,
  });

  const fetchWallets = useCallback(async () => {
    await resource.reload();
  }, [resource.reload]);

  return {
    wallets: resource.data,
    loading: resource.loading,
    fetchWallets,
    setWallets: resource.setData,
  };
};
