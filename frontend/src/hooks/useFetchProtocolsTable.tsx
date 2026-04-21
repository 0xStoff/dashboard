import { useCallback, useMemo } from "react";
import { Protocol } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

interface UseFetchProtocolsReturn {
  protocolsTable: Protocol[];
  totalProtocolUSD: number;
  loading: boolean;
}

export const useFetchProtocolsTable = (
  chain: string | null = "all",
  walletId: string | null = "all",
  searchQuery: string | null
): UseFetchProtocolsReturn => {
  const loadProtocolsTable = useCallback(async () => {
    const url = `/protocols-table?chain=${chain}&wallet_id=${walletId}&query=${searchQuery ?? ""}`;
    const response = await apiClient.get<Protocol[]>(url);
    return response.data;
  }, [searchQuery, chain, walletId]);

  const resource = useApiResource<Protocol[]>({
    initialData: [],
    load: loadProtocolsTable,
    deps: [searchQuery, chain, walletId],
  });

  const totalProtocolUSD = useMemo(
    () => resource.data.reduce((sum, protocol) => sum + protocol.totalUSD, 0),
    [resource.data]
  );

  return { protocolsTable: resource.data, totalProtocolUSD, loading: resource.loading };
};
