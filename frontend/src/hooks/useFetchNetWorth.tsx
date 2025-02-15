import { useState, useEffect } from "react";
import axios from "axios";
import { HistoryData, NetWorthData } from "../interfaces";


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
        const response = await axios.get<NetWorthData[]>(`${process.env.REACT_APP_API_BASE_URL}/net-worth`);
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
      await axios.post(`${process.env.REACT_APP_API_BASE_URL}/net-worth`, payload);
    } catch (error) {
      console.error("Error saving net worth to DB:", error);
    }
  };

  return { netWorth, loading, saveNetWorth };
};