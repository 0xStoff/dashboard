import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchTokens = (chain = 'all', walletId = 'all') => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const url = `${API_BASE_URL}/tokens?chain=${chain}&wallet_id=${walletId}`;

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

  const totalTokenUSD = (tokens).reduce((acc, item) => acc + item.amount * item.price, 0) || 0;

  return { tokens, totalTokenUSD, loading };
};