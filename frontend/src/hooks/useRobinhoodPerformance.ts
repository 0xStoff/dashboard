import { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/api-client";

export interface RobinhoodPerformanceData {
    wallet: string;
    valuation: { ethUsd: number; timestamp: string; historicalPricesAvailable: boolean };
    funding: Record<string, number>;
    reconciliation: { expectedBalance: number; currentBalance: number; difference: number; status: "OK" | "Check"; nativeOutflow: number };
    summary: Record<string, number | boolean> & { partial: boolean; purchasedContracts: number; pricedContracts: number };
    purchases: Array<Record<string, any>>;
    sales: Array<Record<string, any>>;
    tokenPnl: Array<Record<string, any>>;
    otherTokenOutflows: Array<Record<string, any>>;
    sourceCounts: Record<string, number>;
}

export const useRobinhoodPerformance = () => {
    const [data, setData] = useState<RobinhoodPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        force ? setRefreshing(true) : setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<RobinhoodPerformanceData>("/robinhood/performance", {
                params: force ? { refresh: true } : undefined,
            });
            setData(response.data);
        } catch {
            setError("Robinhood performance data is temporarily unavailable.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { void load(false); }, [load]);
    return { data, loading, refreshing, error, refresh: () => load(true) };
};
