import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api';

export const useFetchChains = (walletId = 'all') => {
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const url = `${API_BASE_URL}/chains?wallet_id=${walletId}`;
        const response = await axios.get(url);
        setChains(response.data);
      } catch (error) {
        console.error('Failed to load chains:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChains();
  }, [walletId]);

  return { chains, loading };
};