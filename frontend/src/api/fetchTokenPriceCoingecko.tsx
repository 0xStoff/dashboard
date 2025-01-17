import axios from "axios";

export const fetchTokenPrice = async (coingeckoId: string): Promise<{
    usd: number;
    market_cap?: number;
    usd_24h_vol?: number;
    price_24h_change?: number;
    last_updated_at?: number;
} | null> => {
    try {
        if (!coingeckoId) return null;

        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.REACT_APP_COINGECKO_API_KEY}`,
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


        // Return data with adjusted field name for 24h change
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