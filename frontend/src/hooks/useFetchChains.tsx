import { useState, useEffect } from "react";
import axios from "axios";
import { Chain } from "../interfaces";



interface UseFetchChainsReturn {
  chains: Chain[];
  loading: boolean;
}

export const useFetchChains = (walletId: string | null = "all"): UseFetchChainsReturn => {
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const url = `${process.env.REACT_APP_API_BASE_URL}/chains?wallet_id=${walletId}`;
        const response = await axios.get(url);
        setChains(response.data);
      } catch (error) {
        console.error("Failed to load chains:", error);
      } finally {
        setLoading(false);
      }
    };

    loadChains();
  }, [walletId]);


  return { chains, loading };
};