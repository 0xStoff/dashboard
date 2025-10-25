import axios from "axios";

const fetchTokenPrice = async (coingeckoId) => {
    try {
        if (!coingeckoId) return null;
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`, {
            params: {
                ids: coingeckoId,
                vs_currencies: 'usd',
                include_market_cap: true,
                include_24hr_vol: true,
                include_24hr_change: true,
                include_last_updated_at: true
            }
        });
        return response.data[coingeckoId] ? response.data[coingeckoId] : null;
    } catch (error) {
        console.error(`Error fetching price for ${coingeckoId}:`, error);
        return null;
    }
};

export default fetchTokenPrice