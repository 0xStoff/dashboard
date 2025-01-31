import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchNetWorth = () => {
  const [netWorth, setNetWorth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNetWorth = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/net-worth`);
        setNetWorth(response.data);
      } catch (error) {
        console.error('Failed to load net worth:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNetWorth();
  }, []);

  const saveNetWorth = async (totalNetWorth, historyData) => {
    try {
      const payload = { date: new Date().toISOString(), totalNetWorth, historyData };
      await axios.post(`${API_BASE_URL}/net-worth`, payload);
    } catch (error) {
      console.error("Error saving net worth to DB:", error);
    }
  };

  return { netWorth, loading, saveNetWorth };
};