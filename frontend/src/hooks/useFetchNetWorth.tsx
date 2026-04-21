import { useCallback } from "react";
import { HistoryData, NetWorthData } from "../interfaces";
import apiClient from "../utils/api-client";
import { useApiResource } from "./useApiResource";

interface UseFetchNetWorthReturn {
  netWorth: NetWorthData[];
  loading: boolean;
  saveNetWorth: (totalNetWorth: number, historyData: HistoryData) => Promise<void>;
}

export const useFetchNetWorth = ({ latest, includeDetails }): UseFetchNetWorthReturn => {
  const loadNetWorth = useCallback(async () => {
    const response = await apiClient.get<NetWorthData[] | NetWorthData>(
      `/net-worth?latest=${latest}&includeDetails=${includeDetails}`
    );

    return Array.isArray(response.data) ? response.data : [response.data];
  }, [includeDetails, latest]);

  const resource = useApiResource<NetWorthData[]>({
    initialData: [],
    load: loadNetWorth,
    deps: [latest, includeDetails],
  });

  const saveNetWorth = useCallback(async (totalNetWorth: number, historyData: HistoryData): Promise<void> => {
    try {
      const payload = { date: new Date().toISOString(), totalNetWorth, historyData };
      await apiClient.post(`/net-worth`, payload);
    } catch (error) {
      console.error("Error saving net worth to DB:", error);
    }
  }, []);

  return { netWorth: resource.data, loading: resource.loading, saveNetWorth };
};
