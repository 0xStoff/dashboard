import axios from "axios";

const fetchTokenPrice = async (coingeckoId) => {
    try {
        if (!coingeckoId) return null;
        const apiKey = process.env.COINGECKO_API_KEY?.trim();
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
            params: {
                ...(apiKey ? { x_cg_demo_api_key: apiKey } : {}),
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
        console.warn(`Price lookup failed for ${coingeckoId}: ${error.message}`);
        return null;
    }
};

export default fetchTokenPrice
