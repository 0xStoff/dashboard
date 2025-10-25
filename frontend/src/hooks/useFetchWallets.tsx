import { useState, useEffect } from "react";
import axios from "axios";
import { Wallet } from "../interfaces";
import apiClient from "../utils/api-client";

interface UseFetchWalletsReturn {
  wallets: Wallet[];
  loading: boolean;
}

export const useFetchWallets = (): {
  fetchWallets: () => Promise<void>;
  setWallets: (value: (((prevState: Wallet[]) => Wallet[]) | Wallet[])) => void;
  wallets: Wallet[];
  loading: boolean;
} => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWallets = async () => {
    try {
      const response = await apiClient.get<Wallet[]>("/wallets");

      setWallets(response.data);
    } catch (error) {
      console.error("Failed to load wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  return { wallets, loading, fetchWallets, setWallets };
};