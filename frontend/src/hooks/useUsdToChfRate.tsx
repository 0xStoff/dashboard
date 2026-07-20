import { useEffect, useState } from "react";
import axios from "axios";

export const useUsdToChfRate = () => {
    const [rate, setRate] = useState<number | null>(null);
    const [eurRate, setEurRate] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const [usdResponse, eurResponse] = await Promise.all([
                    axios.get<{rate: number}>("https://api.frankfurter.dev/v2/rate/USD/CHF", {
                        params: {providers: "ECB"},
                    }),
                    axios.get<{rate: number}>("https://api.frankfurter.dev/v2/rate/EUR/CHF", {
                        params: {providers: "ECB"},
                    }),
                ]);

                setRate(Number(usdResponse.data.rate));
                setEurRate(Number(eurResponse.data.rate));
                setError(false);
            } catch (error) {
                console.error("Error fetching fiat exchange rates:", error);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        void fetchRates();
    }, []);

    return { rate, eurRate, loading, error };
};
