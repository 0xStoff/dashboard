import { fetchRobinhoodWalletLedger } from "./blockscoutClient.js";
import { calculateRobinhoodPerformance } from "./performanceAccounting.js";
import WalletModel from "../../models/WalletModel.js";

const CACHE_MS = 5 * 60 * 1000;
const cacheByWallet = new Map();

const findPerformanceWallet = async (userId) => {
    const wallet = await WalletModel.findOne({
        where: { user_id: userId, tag: "MM" },
        attributes: ["wallet"],
    });

    if (!wallet?.wallet) {
        throw new Error("No MM wallet is configured for Robinhood performance tracking");
    }

    return wallet.wallet;
};

export const getRobinhoodPerformance = async ({ userId, force = false } = {}) => {
    if (!userId) throw new Error("Authenticated user is required");

    const address = await findPerformanceWallet(userId);
    const cacheKey = address.toLowerCase();
    const cached = cacheByWallet.get(cacheKey);
    if (!force && cached && Date.now() - cached.savedAt < CACHE_MS) return cached.value;

    const ledger = await fetchRobinhoodWalletLedger(address);
    const value = calculateRobinhoodPerformance({ address, ...ledger });
    cacheByWallet.set(cacheKey, { savedAt: Date.now(), value });
    return value;
};
