import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchProtocols = (chain = null) => {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProtocols = async () => {
      try {
        // Build the URL conditionally based on whether the chain is provided
        const url = `${API_BASE_URL}/protocols?chain=${chain}`;

        const response = await axios.get(url);
        setProtocols(response.data);
      } catch (error) {
        console.error('Failed to load protocols:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProtocols();
  }, [chain]); // Add chain to the dependency array to reload when chain changes

  function calculateTotalUSD(data) {
    return data.reduce((protocolSum, protocol) => {
      const walletsSum = protocol.wallets.reduce((walletSum, wallet) => {
        const portfolioSum = wallet.portfolio_item_list.reduce((itemSum, item) => {
          return itemSum + (item.stats.net_usd_value || 0);
        }, 0);
        return walletSum + portfolioSum;
      }, 0);
      return protocolSum + walletsSum;
    }, 0);
  }

  const totalProtocolUSD = calculateTotalUSD(protocols)

  return { protocols, totalProtocolUSD, loading };
};