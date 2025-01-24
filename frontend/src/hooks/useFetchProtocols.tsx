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

  function calculateTotalUSD(data) {
    return data.reduce((protocolSum, protocol) => {
      const walletsSum = protocol.wallets.reduce((walletSum, wallet) => {
        const portfolioSum = wallet.portfolio_item_list.reduce((itemSum, item) => {
          return itemSum + (item.stats.net_usd_value || 0); // Add net USD value of each portfolio item
        }, 0);
        return walletSum + portfolioSum; // Sum across all portfolio items in the wallet
      }, 0);
      return protocolSum + walletsSum; // Sum across all wallets in the protocol
    }, 0);
  }

  const totalProtocolUSD = calculateTotalUSD(protocols)

  return { protocols, totalProtocolUSD };
};