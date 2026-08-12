import { useCallback } from "react";
import { PortfolioSnapshot } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

interface UsePortfolioSnapshotParams {
  chain: string;
  walletId: string;
  searchQuery: string;
  enabled?: boolean;
}

const emptySnapshot: PortfolioSnapshot = {
  schemaVersion: 1,
  snapshotId: "empty",
  capturedAt: "",
  filters: { chain: "all", walletId: "all", searchQuery: "" },
  totals: { tokenUsd: 0, protocolUsd: 0, totalUsd: 0 },
  chains: [],
  assets: [],
  protocols: [],
  walletSummaries: [],
  dataHealth: {
    source: "canonical-server-snapshot",
    totalMatchesChainSummary: true,
    estimatedAssetCount: 0,
    fuelPrice: null,
    warnings: [],
  },
};

export const usePortfolioSnapshot = ({
  chain,
  walletId,
  searchQuery,
  enabled = true,
}: UsePortfolioSnapshotParams) => {
  const loadSnapshot = useCallback(async () => {
    const response = await apiClient.get<PortfolioSnapshot>("/dashboard/snapshot", {
      params: { chain, wallet_id: walletId, query: searchQuery },
    });
    return response.data;
  }, [chain, walletId, searchQuery]);

  return useApiResource<PortfolioSnapshot>({
    enabled,
    initialData: emptySnapshot,
    load: loadSnapshot,
    deps: [chain, walletId, searchQuery],
  });
};
