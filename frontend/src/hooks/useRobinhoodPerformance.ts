import { useCallback, useEffect, useState } from "react";
import apiClient from "../utils/api-client";

const CACHE_KEY = "robinhood-performance:last-verified";

const readPersistedCache = (): RobinhoodPerformanceData | null => {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) as RobinhoodPerformanceData : null;
    } catch {
        return null;
    }
};

let sessionCache: RobinhoodPerformanceData | null = readPersistedCache();

export interface HistoricalAuditStatus {
    source: string;
    status: "not-started" | "running" | "partial" | "complete" | "failed";
    walletCount: number;
    completedWalletCount: number;
    failedWalletCount: number;
    fetchingWalletCount?: number;
    pendingWalletCount: number;
    isRunning: boolean;
    fetchedAt: string | null;
    includedInAccounting: boolean;
    inventoryIncluded: false;
    automaticRefresh: false;
    addressDisclosure?: "hidden";
    accountingIncorporated?: boolean;
}

export interface CreatorProjectData {
    schemaVersion?: number;
    project?: { chain: string; tokenContract: string };
    devGrossSpendEth?: number;
    devReturnedEth?: number;
    devNetSpendEth?: number;
    devGrossSpendUsd?: number | null;
    devReturnedUsd?: number | null;
    devNetSpendUsd?: number | null;
    walletFuelAmount?: number;
    walletFuelValueUsd?: number | null;
    lpFuelAmount?: number;
    lpPairedValueUsd?: number | null;
    lpEstimatedValueUsd?: number | null;
    pricing?: { method: string; confidence: string; source: string };
    scope?: {
        accountingWallets: Array<{ id: number; address: string; label: string }>;
        inventoryWallets: Array<{ id: number; address: string; label: string }>;
        scopesMatch: boolean;
        historicalAudit?: HistoricalAuditStatus | null;
    };
    fuelLinkedNativeFlow?: {
        outboundNativeEth: number;
        matchingGasEth: number;
        inboundNativeEth: number;
        netNativeEth: number;
        outboundNativeUsdAtCurrentEth: number;
        matchingGasUsdAtCurrentEth: number;
        inboundNativeUsdAtCurrentEth: number;
        netNativeUsdAtCurrentEth: number;
        ethUsd: number;
        matchedTransactionCount: number;
    };
    inventory?: {
        walletFuel: {
            amount: number;
            estimatedValueUsd: number | null;
            pricing: { method: string; confidence: string; source: string };
        };
        liquidity: {
            fuelAmount: number;
            pairedAssetValueUsd: number | null;
            fullPositionEstimatedUsd: number | null;
            positions: Array<{
                name: string;
                fuelAmount: number;
                pairedValueUsd: number | null;
                estimatedValueUsd: number | null;
                pricing: { method: string; confidence: string; source: string };
            }>;
        };
        combinedEstimatedValueUsd: number | null;
    };
    audit?: {
        status: "partial" | "not-calculated" | "ready" | "stale";
        calculatedAt: string;
        internalTransactionsAvailable: boolean;
        historicalUsdAvailable: boolean;
        limitations: string[];
    };
    events?: Array<{
        hash: string;
        transactionUrl: string;
        timestamp: string | null;
        direction: string;
        outboundNativeEth: number;
        matchingGasEth: number;
        inboundNativeEth: number;
        fuelTransferCount: number;
    }>;
}

export interface RobinhoodPerformanceData {
    wallet: string;
    wallets?: string[];
    valuation: { ethUsd: number; timestamp: string; historicalPricesAvailable: boolean };
    funding: Record<string, number>;
    reconciliation: { expectedBalance: number; currentBalance: number; difference: number; status: "OK" | "Check" | "Incomplete"; nativeOutflow: number; authoritative?: boolean; incompleteReason?: string | null };
    summary: Record<string, number | boolean> & { partial: boolean; purchasedContracts: number; pricedContracts: number };
    purchases: Array<Record<string, any>>;
    sales: Array<Record<string, any>>;
    tokenPnl: Array<Record<string, any>>;
    portfolioPnl?: {
        tokenPnlUsd: number;
        lpPnlUsd: number | null;
        totalPnlUsd: number | null;
        knownLpPnlUsd?: number;
        knownTotalPnlUsd?: number;
        completeness: "complete" | "partial";
        tokenPnlComplete?: boolean;
        unassignedOperationCount: number;
        valuedLpLifecycleCount: number;
        incompleteLpStrategyCount?: number;
    };
    lpStrategies?: Array<{
        strategyKey: string;
        pair: string;
        status: "open" | "closed";
        positionIds: string[];
        livePositionIds: string[];
        depositsUsd: number;
        returnedUsd: number;
        gasUsd: number;
        netInvestedUsd: number;
        currentValueUsd: number;
        pnlUsd: number | null;
        returnPercent: number | null;
        accountingStatus: "tracked" | "pending";
        incompletePositionIds: string[];
        events: LpLifecycleEvent[];
    }>;
    manualClassifications?: RobinhoodTransactionClassification[];
    otherTokenOutflows: Array<Record<string, any>>;
    sourceCounts: Record<string, number>;
    dataQuality?: { internalTransactionsAvailable: boolean };
    dataFreshness?: {
        source: "live" | "cache" | "stale-cache";
        asOf: string;
        stale: boolean;
        lastError?: string | null;
        isIndexing?: boolean;
        indexingMessage?: string | null;
    };
    lpPerformance?: Array<{
        positionId: string | null;
        wallet: string;
        pair: string;
        currentValueUsd: number;
        depositsUsd: number | null;
        returnedUsd: number | null;
        gasUsd: number | null;
        pnlUsd: number | null;
        returnPercent: number | null;
        feesEarnedUsd: number | null;
        impermanentLossUsd: number | null;
        accountingStatus: "tracked" | "partial" | "unmatched";
        matchConfidence?: string | null;
        events?: LpLifecycleEvent[];
    }>;
    lpLifecycle?: {
        positions: LpLifecyclePosition[];
        unmatchedMovements?: LpLifecycleEvent[];
        classifiedActivities?: LpLifecycleEvent[];
        movementCount?: number;
    };
    creatorProject?: CreatorProjectData;
    historicalAudit?: HistoricalAuditStatus;
    currentState?: {
        source: "database";
        holdings: Array<{
            contract: string;
            symbol: string;
            name: string;
            amount: number;
            price: number;
            usdValue: number;
            logoPath?: string | null;
            wallets?: Array<{ id: number; tag: string; amount: number; usdValue: number }>;
        }>;
        protocolPositions?: Array<{
            id: string;
            walletTag: string;
            protocol: string;
            chain: string;
            name: string;
            kind: "LP" | "Protocol";
            currentValueUsd: number;
            pricing: { method: string; confidence: string; source: string };
            assets: Array<{ contract: string; symbol: string; name: string; amount: number; price: number; usdValue: number; logoPath?: string | null }>;
            range: null;
            feesEarnedUsd: null;
            initialDepositUsd: null;
        }>;
    };
}

export interface LpLifecycleTokenFlow {
    contract: string;
    symbol: string;
    name: string;
    quantity: number;
    currentUsdPrice: number | null;
}

export interface LpLifecycleEvent {
    positionId: string | null;
    wallet: string;
    hash: string;
    transactionUrl: string;
    timestamp: string | null;
    type: "mint" | "increase" | "reposition" | "decrease-or-collect" | "close" | "modify";
    depositedTokens: LpLifecycleTokenFlow[];
    returnedTokens: LpLifecycleTokenFlow[];
    nativeDepositEth: number;
    nativeDepositUsd: number;
    tokenDepositUsd: number;
    nativeReturnedEth: number;
    nativeReturnedUsd: number;
    returnedUsd: number;
    gasEth: number;
    gasUsd: number;
    accountingStatus: "matched" | "unmatched";
    valuationStatus: "valued" | "partial";
    manualClassification?: RobinhoodTransactionClassification;
}

export interface LpLifecyclePosition {
    positionId: string;
    wallet: string;
    openedAt: string | null;
    closedAt: string | null;
    status: "open" | "closed" | "unresolved";
    matchConfidence: "exact-nft" | "calldata-position-id" | "single-active-position" | "manual";
    valuationStatus: "valued" | "partial";
    depositsUsd: number;
    returnedUsd: number;
    gasUsd: number;
    events: LpLifecycleEvent[];
    pair?: string;
    walletTag?: string | null;
    providerPositionId?: string | null;
    currentValueUsd?: number | null;
    pnlUsd?: number | null;
    returnPercent?: number | null;
    manual?: boolean;
}

export interface RobinhoodTransactionClassification {
    transactionHash: string;
    classification: "lp" | "swap" | "transfer" | "fee-collection" | "ignore" | "unknown";
    lifecycleKey: string | null;
    label: string | null;
    notes: string | null;
    metadata: { status?: "open" | "closed" };
    updatedAt?: string;
}

export const useRobinhoodPerformance = () => {
    const [data, setData] = useState<RobinhoodPerformanceData | null>(sessionCache);
    const [loading, setLoading] = useState(!sessionCache);
    const [refreshing, setRefreshing] = useState(false);
    const [savingClassification, setSavingClassification] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        force ? setRefreshing(true) : !sessionCache && setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<RobinhoodPerformanceData>("/robinhood/performance", {
                params: force ? { refresh: true } : undefined,
            });
            const nextData = response.data;
            sessionCache = nextData;
            try {
                window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextData));
            } catch {
                // A visible cached view is an enhancement, never a requirement.
            }
            setData(nextData);
            setRefreshing(false);
        } catch {
            // Retain a verified view if the background explorer request is
            // rate-limited; an error should never erase usable portfolio data.
            if (!sessionCache) setError("Robinhood performance data is temporarily unavailable.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load(false);
    }, [load]);

    useEffect(() => {
        if (!data?.dataFreshness?.isIndexing) return undefined;
        const poll = window.setInterval(() => void load(false), 5_000);
        return () => window.clearInterval(poll);
    }, [Boolean(data?.dataFreshness?.isIndexing), load]);

    const assignTransaction = useCallback(async (
        transactionHash: string,
        assignment: Omit<RobinhoodTransactionClassification, "transactionHash" | "updatedAt">
    ) => {
        setSavingClassification(true);
        try {
            await apiClient.put(`/robinhood/classifications/${transactionHash}`, assignment);
            await load(false);
        } finally {
            setSavingClassification(false);
        }
    }, [load]);

    const resetTransactionAssignment = useCallback(async (transactionHash: string) => {
        setSavingClassification(true);
        try {
            await apiClient.delete(`/robinhood/classifications/${transactionHash}`);
            await load(false);
        } finally {
            setSavingClassification(false);
        }
    }, [load]);

    return {
        data,
        loading,
        refreshing: refreshing || Boolean(data?.dataFreshness?.isIndexing),
        savingClassification,
        error,
        refresh: () => load(true),
        assignTransaction,
        resetTransactionAssignment,
    };
};
