import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchNetWorth = () => {

  const [netWorth, setNetWorth] = useState([]);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const loadWallets = async () => {
      try {
        const url =  `${API_BASE_URL}/net-worth`;

        const response = await axios.get(url);
        setNetWorth(response.data);

      } catch (error) {
        console.error('Failed to load netWorth:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWallets();
  }, []); // Add chain to the dependency array to reload when chain changes

  return { netWorth, loading };
};