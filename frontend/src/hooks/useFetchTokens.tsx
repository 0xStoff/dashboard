import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchTokens = (chain = null) => {
  const [tokens, setTokens] = useState([]);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Build the URL conditionally based on whether the chain is provided
        const url = `${API_BASE_URL}/tokens`;

        const response = await axios.get(url);
        setTokens(response.data);
      } catch (error) {
        console.error('Failed to load tokens:', error);
      }
    };

    loadTokens();
  }, [chain]); // Add chain to the dependency array to reload when chain changes

  const totalTokenUSD = (tokens).reduce((acc, item) => acc + item.amount * item.price, 0) || 0;

  return { tokens, totalTokenUSD };
};