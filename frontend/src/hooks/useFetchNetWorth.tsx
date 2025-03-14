import { useState, useEffect } from "react";
import axios from "axios";
import { HistoryData, NetWorthData } from "../interfaces";
import apiClient from "../utils/api-client";


interface UseFetchNetWorthReturn {
  netWorth: NetWorthData[];
  loading: boolean;
  saveNetWorth: (totalNetWorth: number, historyData: HistoryData) => Promise<void>;
}

export const useFetchNetWorth = (): UseFetchNetWorthReturn => {
  const [netWorth, setNetWorth] = useState<NetWorthData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadNetWorth = async () => {
      try {
        const response = await apiClient.get<NetWorthData[]>(`/net-worth`);
        setNetWorth(response.data);
      } catch (error) {
        console.error("Failed to load net worth:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNetWorth();
  }, []);

  const saveNetWorth = async (totalNetWorth: number, historyData: HistoryData): Promise<void> => {
    try {
      const payload = { date: new Date().toISOString(), totalNetWorth, historyData };
      await apiClient.post(`/net-worth`, payload);
    } catch (error) {
      console.error("Error saving net worth to DB:", error);
    }
  };

  return { netWorth, loading, saveNetWorth };
};