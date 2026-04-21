import SettingsModel from "../models/SettingsModel.js";

const HIDE_SMALL_BALANCES_KEY = "HIDESMALLBALANCES";
const DEFAULT_HIDE_SMALL_BALANCES = 10;

export const getHideSmallBalances = async () => {
    const setting = await SettingsModel.findOne({
        where: { key: HIDE_SMALL_BALANCES_KEY },
    });

    return Number(setting?.value ?? DEFAULT_HIDE_SMALL_BALANCES);
};

export const setHideSmallBalances = async (value) => {
    await SettingsModel.upsert({
        key: HIDE_SMALL_BALANCES_KEY,
        value,
    });
};
