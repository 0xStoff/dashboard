import { useState, useEffect } from 'react';
import axios from "axios";


const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

export const useFetchWallets = () => {
    const [wallets, setWallets] = useState([]);

    useEffect(() => {
        const loadWallets = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/wallets`);
                setWallets(response.data);
            } catch (error) {
                console.error('Failed to load wallets:', error);
            }
        };

        loadWallets();
    }, []);

    return wallets;
};