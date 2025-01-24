import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchProtocols = (chain = null) => {
  const [protocols, setProtocols] = useState([]);

  useEffect(() => {
    const loadProtocols = async () => {
      try {
        // Build the URL conditionally based on whether the chain is provided
        const url = `${API_BASE_URL}/protocols`;

        const response = await axios.get(url);
        setProtocols(response.data);
      } catch (error) {
        console.error('Failed to load protocols:', error);
      }
    };

    loadProtocols();
  }, [chain]); // Add chain to the dependency array to reload when chain changes

  return protocols;
};