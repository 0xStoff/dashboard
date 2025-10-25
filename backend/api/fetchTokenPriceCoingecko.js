import axios from "axios";

export const fetchTokenPriceCoingecko = async (coingeckoId) => {
    try {
        if (!coingeckoId) return null;

        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`,
            {
                params: {
                    ids: coingeckoId,
                    vs_currencies: 'usd',
                    include_market_cap: true,
                    include_24hr_vol: true,
                    include_24hr_change: true,
                    include_last_updated_at: true
                }
            }
        );

        const tokenData = response.data[coingeckoId];
        if (!tokenData || !tokenData.usd) return null;


        return {
            usd: tokenData.usd,
            market_cap: tokenData.usd_market_cap,
            usd_24h_vol: tokenData.usd_24h_vol,
            price_24h_change: tokenData.usd_24h_change / 100,
            last_updated_at: tokenData.last_updated_at
        };
    } catch (error) {
        console.error(`Error fetching price for ${coingeckoId}:`, error);
        return null;
    }
};