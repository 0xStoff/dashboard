import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchProtocolsTable = (chain = 'all') => {
  const [protocolsTable, setProtocolsTable] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProtocolsTable = async () => {
      try {
        const url = `${API_BASE_URL}/protocols-table?chain=${chain}`;

        const response = await axios.get(url);
        setProtocolsTable(response.data);
      } catch (error) {
        console.error('Failed to load protocolsTable:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProtocolsTable();
  }, [chain]);


  return { protocolsTable, loading };
};