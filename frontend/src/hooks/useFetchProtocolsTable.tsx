import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchProtocolsTable = (chain = 'all', walletId = 'all') => {
  const [protocolsTable, setProtocolsTable] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProtocolsTable = async () => {
      try {
        const url = `${API_BASE_URL}/protocols-table?chain=${chain}&wallet_id=${walletId}`;

        const response = await axios.get(url);
        setProtocolsTable(response.data);
      } catch (error) {
        console.error('Failed to load protocolsTable:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProtocolsTable();
  }, [chain, walletId]);


  const totalProtocolUSD = protocolsTable.reduce((sum, protocol) => sum + protocol.totalUSD, 0);

  return { protocolsTable, totalProtocolUSD, loading };
};