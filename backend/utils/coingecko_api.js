import axios from "axios";

const fetchTokenPrice = async (coingeckoId) => {
    try {
        if (!coingeckoId) return null;
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`, {
            params: {
                ids: coingeckoId, vs_currencies: 'usd'
            }
        });
        return response.data[coingeckoId]?.usd ? {usd: response.data[coingeckoId].usd} : null;
    } catch (error) {
        console.error(`Error fetching price for ${coingeckoId}:`, error);
        return null;
    }
};

export default fetchTokenPrice