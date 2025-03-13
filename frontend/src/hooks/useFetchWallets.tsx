import { useState, useEffect } from "react";
import axios from "axios";
import { Wallet } from "../interfaces";
import apiClient from "../utils/api-client";


interface UseFetchWalletsReturn {
  wallets: Wallet[];
  loading: boolean;
}
export const useFetchWallets = (chain: string | null = null): UseFetchWalletsReturn => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadWallets = async () => {
      try {
        const url = chain ? `${process.env.REACT_APP_API_BASE_URL}/wallets?chain=${chain}` : `${process.env.REACT_APP_API_BASE_URL}/wallets`;

        const response = await apiClient.get<Wallet[]>(url);
        setWallets(response.data);
      } catch (error) {
        console.error("Failed to load wallets:", error);
      } finally {
        setLoading(false);
      }
    };

    loadWallets();
  }, [chain]);

  return { wallets, loading };
};