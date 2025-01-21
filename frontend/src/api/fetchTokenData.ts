import axios from 'axios';


export const fetchTokenData = async (): Promise<T> => {
  try {
    const response = await axios.get('http://localhost:3000/api/wallets');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch token data:', error);
    throw new Error(
      `Error fetching token data: ${axios.isAxiosError(error) ? error.message : 'Unknown error'}`
    );
  }
};