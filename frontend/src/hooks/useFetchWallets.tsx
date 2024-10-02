import { useState, useEffect } from 'react';
import axios from "axios";

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchWallets = (chain = null) => {
    const [wallets, setWallets] = useState([]);

    useEffect(() => {
        const loadWallets = async () => {
            try {
                // Build the URL conditionally based on whether the chain is provided
                const url = chain ? `${API_BASE_URL}/wallets?chain=${chain}` : `${API_BASE_URL}/wallets`;

                const response = await axios.get(url);
                setWallets(response.data);
            } catch (error) {
                console.error('Failed to load wallets:', error);
            }
        };

        loadWallets();
    }, [chain]); // Add chain to the dependency array to reload when chain changes

    return wallets;
};