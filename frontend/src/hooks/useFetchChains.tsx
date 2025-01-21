import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api';

export const useFetchChains = (chain = null) => {
  const [chains, setChains] = useState([]);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const url = `${API_BASE_URL}/chains`;
        const response = await axios.get(url);
        setChains(response.data);
      } catch (error) {
        console.error('Failed to load chains:', error);
      }
    };

    loadChains();
  }, [chain]);

  return chains;
};