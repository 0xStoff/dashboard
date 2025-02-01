import { useState, useEffect } from "react";
import axios from "axios";
import { Protocol } from "../interfaces";


interface UseFetchProtocolsReturn {
  protocolsTable: Protocol[];
  totalProtocolUSD: string | number;
  loading: boolean;
}

export const useFetchProtocolsTable = (chain: string | null    = "all",
                                       walletId: string | null = "all",
                                       searchQuery: string | null): UseFetchProtocolsReturn => {
  const [protocolsTable, setProtocolsTable] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadProtocolsTable = async () => {
      try {
        const url = `${process.env.REACT_APP_API_BASE_URL}/protocols-table?chain=${chain}&wallet_id=${walletId}&query=${searchQuery}`;

        const response = await axios.get(url);
        setProtocolsTable(response.data);
      } catch (error) {
        console.error("Failed to load protocolsTable:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProtocolsTable();
  }, [searchQuery, chain, walletId]);


  const totalProtocolUSD = protocolsTable.reduce((sum, protocol) => sum + protocol.totalUSD, 0);

  console.log(protocolsTable)
  return { protocolsTable, totalProtocolUSD, loading };
};