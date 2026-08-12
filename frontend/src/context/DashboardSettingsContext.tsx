import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface DashboardSettings {
    defaultCurrency: "CHF" | "$";
}

interface DashboardSettingsContextValue {
    settings: DashboardSettings;
    updateSettings: (patch: Partial<DashboardSettings>) => Promise<void>;
    reload: () => Promise<void>;
}

const STORAGE_KEY = "dashboard-settings";
const defaults: DashboardSettings = { defaultCurrency: "CHF" };

const readSettings = (): DashboardSettings => {
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
        return { ...defaults, ...stored };
    } catch {
        return defaults;
    }
};

const DashboardSettingsContext = createContext<DashboardSettingsContextValue | null>(null);

export const DashboardSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<DashboardSettings>(readSettings);
    const updateSettings = useCallback(async (patch: Partial<DashboardSettings>) => {
        setSettings((previous) => {
            const next = { ...previous, ...patch };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);
    const reload = useCallback(async () => setSettings(readSettings()), []);
    const value = useMemo(() => ({ settings, updateSettings, reload }), [reload, settings, updateSettings]);
    return <DashboardSettingsContext.Provider value={value}>{children}</DashboardSettingsContext.Provider>;
};

export const useDashboardSettings = () => {
    const context = useContext(DashboardSettingsContext);
    if (!context) throw new Error("useDashboardSettings must be used inside DashboardSettingsProvider");
    return context;
};
