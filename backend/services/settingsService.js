import SettingsModel from "../models/SettingsModel.js";

const HIDE_SMALL_BALANCES_KEY = "HIDESMALLBALANCES";
const DEFAULT_THRESHOLD = 10;
const THRESHOLD_MAX = 100;

const DEFAULTS = {
    hideSmallAssetBalances: DEFAULT_THRESHOLD,
    hideSmallProtocolBalances: DEFAULT_THRESHOLD,
    hideSmallNetworkBalances: DEFAULT_THRESHOLD,
    defaultCurrencyChf: 0,
    walletChipCount: 3,
    compactRows: 0,
};

const KEYS = {
    hideSmallAssetBalances: "HIDESMALLASSETBALANCES",
    hideSmallProtocolBalances: "HIDESMALLPROTOCOLBALANCES",
    hideSmallNetworkBalances: "HIDESMALLNETWORKBALANCES",
    defaultCurrencyChf: "DEFAULTCURRENCYCHF",
    walletChipCount: "WALLETCHIPCOUNT",
    compactRows: "COMPACTROWS",
};

const clampThreshold = (value, fallback = DEFAULT_THRESHOLD) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.max(0, Math.min(THRESHOLD_MAX, numericValue));
};

const clampWalletChipCount = (value) => Math.max(1, Math.min(6, Math.round(Number(value) || DEFAULTS.walletChipCount)));

export const getDashboardSettings = async () => {
    const rows = await SettingsModel.findAll({ where: { key: [...Object.values(KEYS), HIDE_SMALL_BALANCES_KEY] } });
    const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
    const legacyHideSmallBalances = clampThreshold(values.get(HIDE_SMALL_BALANCES_KEY), DEFAULT_THRESHOLD);

    return {
        hideSmallAssetBalances: clampThreshold(values.get(KEYS.hideSmallAssetBalances), legacyHideSmallBalances),
        hideSmallProtocolBalances: clampThreshold(values.get(KEYS.hideSmallProtocolBalances), legacyHideSmallBalances),
        hideSmallNetworkBalances: clampThreshold(values.get(KEYS.hideSmallNetworkBalances), legacyHideSmallBalances),
        defaultCurrencyChf: [0, 1].includes(values.get(KEYS.defaultCurrencyChf)) ? values.get(KEYS.defaultCurrencyChf) : DEFAULTS.defaultCurrencyChf,
        walletChipCount: clampWalletChipCount(values.get(KEYS.walletChipCount)),
        compactRows: values.get(KEYS.compactRows) === 1 ? 1 : 0,
    };
};

export const setDashboardSettings = async (settings) => {
    const sanitizedSettings = {
        hideSmallAssetBalances: clampThreshold(settings.hideSmallAssetBalances),
        hideSmallProtocolBalances: clampThreshold(settings.hideSmallProtocolBalances),
        hideSmallNetworkBalances: clampThreshold(settings.hideSmallNetworkBalances),
        defaultCurrencyChf: settings.defaultCurrencyChf === 1 ? 1 : 0,
        walletChipCount: clampWalletChipCount(settings.walletChipCount),
        compactRows: settings.compactRows === 1 ? 1 : 0,
    };

    await Promise.all([
        ...Object.entries(sanitizedSettings).map(([name, value]) =>
            SettingsModel.upsert({ key: KEYS[name], value })
        ),
        SettingsModel.upsert({ key: HIDE_SMALL_BALANCES_KEY, value: sanitizedSettings.hideSmallAssetBalances }),
    ]);

    return getDashboardSettings();
};

export const getHideSmallBalances = async () => {
    const settings = await getDashboardSettings();
    return settings.hideSmallAssetBalances;
};

export const setHideSmallBalances = async (value) => {
    const threshold = clampThreshold(value);
    await Promise.all([
        SettingsModel.upsert({
            key: HIDE_SMALL_BALANCES_KEY,
            value: threshold,
        }),
        SettingsModel.upsert({
            key: KEYS.hideSmallAssetBalances,
            value: threshold,
        }),
    ]);
};
