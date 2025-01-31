import { useState, useEffect } from 'react';
import axios from "axios";
import { Wallet } from "./useFetchWallets";
import { Token } from "../interfaces";


interface UseFetchTokensReturn {
  tokens: Token[];
  totalTokenUSD: string | number;
  loading: boolean;
}

export const useFetchTokens = (chain: string | null = 'all', walletId: string | null = 'all'): UseFetchTokensReturn => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const url = `${process.env.REACT_APP_API_BASE_URL}/tokens?chain=${chain}&wallet_id=${walletId}`;

        const response = await axios.get(url);
        setTokens(response.data);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, [chain, walletId]);

  const totalTokenUSD = (tokens).reduce((sum, item) => sum + item.total_usd_value, 0) || 0;

  return { tokens, totalTokenUSD, loading };
};