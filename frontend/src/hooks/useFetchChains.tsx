import { useState, useEffect } from "react";
import axios from "axios";
import { Chain } from "../interfaces";
import apiClient from "../utils/api-client";



interface UseFetchChainsReturn {
  chains: Chain[];
  loading: boolean;
}

export const useFetchChains = (walletId: string | null = "all", searchQuery: string): UseFetchChainsReturn => {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const url = `${process.env.REACT_APP_API_BASE_URL}/chains?wallet_id=${walletId}&query=${searchQuery}`;
        const response = await apiClient.get(url);
        setChains(response.data);
      } catch (error) {
        console.error("Failed to load chains:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChains();
  }, [walletId, searchQuery]);


  return { chains, loading };
};