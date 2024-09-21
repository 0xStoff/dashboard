// src/api/apiService.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api'; // Base URL for your API

// Function to fetch wallet data
export const fetchWallets = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/wallets`);
        return response.data; // Return the wallet data
    } catch (error) {
        console.error('Error fetching wallets:', error);
        throw error; // Rethrow the error for handling in the calling function
    }
};