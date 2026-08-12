import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "../utils/api-client";

const clampThreshold = (value: unknown, fallback: number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(100, numericValue));
};

const clampWalletChipCount = (value: unknown, fallback: number) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.min(6, Math.round(numericValue)));
};

export interface DashboardSettings {
  hideSmallAssetBalances: number;
  hideSmallProtocolBalances: number;
  hideSmallNetworkBalances: number;
  defaultCurrency: "CHF" | "$";
  walletChipCount: number;
  compactRows: boolean;
}

const DEFAULT_SETTINGS: DashboardSettings = {
  hideSmallAssetBalances: 10,
  hideSmallProtocolBalances: 10,
  hideSmallNetworkBalances: 10,
  defaultCurrency: "$",
  walletChipCount: 3,
  compactRows: false,
};

interface DashboardSettingsContextValue {
  settings: DashboardSettings;
  loading: boolean;
  reload: () => Promise<void>;
  updateSettings: (settings: Partial<DashboardSettings>) => Promise<void>;
}

const DashboardSettingsContext = createContext<DashboardSettingsContextValue | null>(null);

const fromApi = (value: Record<string, number>): DashboardSettings => {
  const legacyHideSmallBalances = clampThreshold(value.hideSmallBalances, DEFAULT_SETTINGS.hideSmallAssetBalances);
  return {
    hideSmallAssetBalances: clampThreshold(value.hideSmallAssetBalances, legacyHideSmallBalances),
    hideSmallProtocolBalances: clampThreshold(value.hideSmallProtocolBalances, legacyHideSmallBalances),
    hideSmallNetworkBalances: clampThreshold(value.hideSmallNetworkBalances, legacyHideSmallBalances),
    defaultCurrency: Number(value.defaultCurrencyChf) === 1 ? "CHF" : "$",
    walletChipCount: clampWalletChipCount(value.walletChipCount, DEFAULT_SETTINGS.walletChipCount),
    compactRows: Number(value.compactRows) === 1,
  };
};

const toApi = (value: DashboardSettings) => ({
  hideSmallBalances: value.hideSmallAssetBalances,
  hideSmallAssetBalances: value.hideSmallAssetBalances,
  hideSmallProtocolBalances: value.hideSmallProtocolBalances,
  hideSmallNetworkBalances: value.hideSmallNetworkBalances,
  defaultCurrencyChf: value.defaultCurrency === "CHF" ? 1 : 0,
  walletChipCount: value.walletChipCount,
  compactRows: value.compactRows ? 1 : 0,
});

export const DashboardSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const response = await apiClient.get<Record<string, number>>("/settings/");
      setSettings(fromApi(response.data));
    } catch {
      // Authentication may not be established during the initial app shell.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateSettings = useCallback(async (partial: Partial<DashboardSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    try {
      const response = await apiClient.put<Record<string, number>>("/settings/", toApi(next));
      setSettings(fromApi(response.data));
    } catch (error) {
      await reload();
      throw error;
    }
  }, [reload, settings]);

  const value = useMemo(
    () => ({ settings, loading, reload, updateSettings }),
    [loading, reload, settings, updateSettings]
  );

  return <DashboardSettingsContext.Provider value={value}>{children}</DashboardSettingsContext.Provider>;
};

export const useDashboardSettings = () => {
  const context = useContext(DashboardSettingsContext);
  if (!context) throw new Error("useDashboardSettings must be used inside DashboardSettingsProvider");
  return context;
};
