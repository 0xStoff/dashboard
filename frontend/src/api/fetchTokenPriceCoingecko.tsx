import axios from "axios";

export const fetchTokenPrice = async (coingeckoId: string): Promise<{ usd: number } | null> => {
    try {
        if (!coingeckoId) return null;
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.REACT_APP_COINGECKO_API_KEY}`, {
            params: {
                ids: coingeckoId, // TokenModel name in CoinGecko's format
                vs_currencies: 'usd'
            }
        });
        return response.data[coingeckoId]?.usd ? {usd: response.data[coingeckoId].usd} : null;
    } catch (error) {
        console.error(`Error fetching price for ${coingeckoId}:`, error);
        return null;
    }
};