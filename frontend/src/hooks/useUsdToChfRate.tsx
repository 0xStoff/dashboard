import { useEffect, useState } from "react";
import axios from "axios";

export const useUsdToChfRate = () => {
    const [rate, setRate] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsdToChfRate = async () => {
            try {
                const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
                    params: {
                        ids: "usd",
                        vs_currencies: "chf",
                        x_cg_demo_api_key: process.env.REACT_APP_COINGECKO_API_KEY,
                    },
                });
                const newRate = response.data.usd?.chf ?? null;
                if (newRate) setRate(newRate);
            } catch (error) {
                console.error("Error fetching USD to CHF rate:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsdToChfRate();
    }, []);

    return { rate, loading };
};