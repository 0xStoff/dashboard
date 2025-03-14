import { useState, useEffect } from "react";
import axios from "axios";
import { Wallet } from "../interfaces";
import apiClient from "../utils/api-client";


interface UseFetchWalletsReturn {
  wallets: Wallet[];
  loading: boolean;
}
export const useFetchWallets = (chain: string | null = null): {
  fetchWallets: () => Promise<void>;
  setWallets: (value: (prevWallets) => ({
    chain: string;
    wallet: string;
    id: number;
    tag: string;
    show_chip: boolean
  } | Wallet)[]) => void;
  wallets: Wallet[];
  loading: boolean
} => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const fetchWallets = async () => {
    try {
      const url = chain ? `/wallets?chain=${chain}` : `/wallets`;

      const response = await apiClient.get<Wallet[]>(url);
      setWallets(response.data);
    } catch (error) {
      console.error("Failed to load wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [chain]);

  return { wallets, loading, fetchWallets, setWallets };
};