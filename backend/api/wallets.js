import express from "express";
import { Op } from "sequelize";
import {
    fetchAndSaveEvmTokenData,
    fetchAndSaveHyperliquidData,
    fetchAndSaveHyperliquidDataForAllWallets,
    fetchAndSaveSolTokenDataForAllWallets,
    fetchCosmosTokens,
    writeAptosDataToDB,
    writeStaticDataToDB,
    writeSuiDataToDB,
} from "../token_data/index.js";
import WalletModel from "../models/WalletModel.js";
import { SUPPORTED_TRACKED_WALLET_CHAINS } from "../config/supportedChains.js";
import fetchDebankData from "../utils/debank_api.js";
import { capturePortfolioSnapshot, getPortfolioSnapshot } from "../services/portfolioSnapshotService.js";
import { enqueueRefreshJob, getRefreshJob } from "../services/refreshJobService.js";

const router = express.Router();
const REFRESH_POLICIES = new Set(["auto", "manual", "audit-only"]);

const getUserId = (req) => req.user?.user?.id;

const normalizeRefreshPolicy = (value, fallback = "auto") =>
    REFRESH_POLICIES.has(String(value || "").trim())
        ? String(value).trim()
        : fallback;

const getOwnedWallet = async (walletId, userId) =>
    WalletModel.findOne({
        where: {
            id: walletId,
            user_id: userId,
        },
    });

const getWalletApproximateValues = async (userId) => {
    // Settings must use the same canonical values as the dashboard. This is a
    // single batched DB read; it does not trigger provider calls or one query
    // per wallet.
    const snapshot = await getPortfolioSnapshot({ userId });
    return {
        capturedAt: snapshot.capturedAt,
        source: snapshot.dataHealth.source,
        byWalletId: new Map(snapshot.walletSummaries.map((summary) => [summary.walletId, summary])),
    };
};

const runRefreshTasks = async (tasks, report = async () => {}) => {
    const entries = Object.entries(tasks);
    const results = [];
    for (let index = 0; index < entries.length; index += 1) {
        const [provider, task] = entries[index];
        await report({ phase: `Refreshing ${provider}`, provider, current: index, total: entries.length });
        try {
            const details = await task();
            results.push(details?.skipped
                ? { provider, status: "skipped", details }
                : { provider, status: "success", details: details || null });
        } catch (error) {
            console.error(`${provider} refetch failed:`, error.message);
            results.push({ provider, status: "failed", error: error.message });
        }
    }
    await report({ phase: "Finalizing refresh", current: entries.length, total: entries.length });
    return results;
};

const captureAfterRefresh = async (userId) => {
    if (!userId) return null;
    try {
        return await capturePortfolioSnapshot(userId);
    } catch (error) {
        console.error("Portfolio snapshot failed after refresh:", error.message);
        return { skipped: true, reason: "History capture failed" };
    }
};

const createRefreshRequest = (userId) => ({ user: { user: { id: userId } } });

const refreshEvmWallets = async ({ userId, walletIds = null, report, capture = true }) => {
    const where = { user_id: userId, chain: "evm" };
    if (walletIds) {
        // Explicit selected refresh may include audit-only wallets.
        where.id = { [Op.in]: walletIds };
    } else {
        // Routine refreshes avoid history/audit wallets and their API spend.
        where.refresh_policy = "auto";
    }
    const wallets = await WalletModel.findAll({ where, order: [["id", "ASC"]] });
    if (!wallets.length) throw new Error("No eligible EVM wallets were found");

    const refreshRequest = createRefreshRequest(userId);
    const results = [];
    for (let index = 0; index < wallets.length; index += 1) {
        const wallet = wallets[index];
        await report({
            phase: `Refreshing ${wallet.tag}`,
            provider: "evm",
            walletId: wallet.id,
            current: index,
            total: wallets.length,
        });
        try {
            await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, refreshRequest, { forceTokens: true });
            results.push({ walletId: wallet.id, tag: wallet.tag, provider: "evm", status: "success" });
        } catch (error) {
            results.push({ walletId: wallet.id, tag: wallet.tag, provider: "evm", status: "failed", error: error.message });
        }
    }
    await report({ phase: "Finalizing EVM refresh", provider: "evm", current: wallets.length, total: wallets.length });
    const snapshot = capture && results.some((result) => result.status === "success") ? await captureAfterRefresh(userId) : null;
    return { results, snapshot };
};

const refreshAllWallets = async ({ userId, report }) => {
    const results = await runRefreshTasks({
        evm: () => refreshEvmWallets({ userId, report, capture: false }),
        solana: () => fetchAndSaveSolTokenDataForAllWallets(userId),
        sui: () => writeSuiDataToDB(userId),
        aptos: () => writeAptosDataToDB(userId),
        cosmos: () => fetchCosmosTokens(userId),
        hyperliquid: () => fetchAndSaveHyperliquidDataForAllWallets(userId),
        static: writeStaticDataToDB,
    }, report);
    const snapshot = results.some((result) => result.status === "success") ? await captureAfterRefresh(userId) : null;
    return { results, snapshot };
};

const refreshOtherWallets = async ({ userId, report }) => {
    const results = await runRefreshTasks({
        solana: () => fetchAndSaveSolTokenDataForAllWallets(userId),
        sui: () => writeSuiDataToDB(userId),
        aptos: () => writeAptosDataToDB(userId),
        cosmos: () => fetchCosmosTokens(userId),
        hyperliquid: () => fetchAndSaveHyperliquidDataForAllWallets(userId),
        static: writeStaticDataToDB,
    }, report);
    const snapshot = results.some((result) => result.status === "success") ? await captureAfterRefresh(userId) : null;
    return { results, snapshot };
};

const refreshSelectedEvmAndFreeChains = async ({ userId, walletIds, report }) => {
    const evm = await refreshEvmWallets({ userId, walletIds, report, capture: false });
    const freeChainResults = await runRefreshTasks({
        solana: () => fetchAndSaveSolTokenDataForAllWallets(userId),
        sui: () => writeSuiDataToDB(userId),
        aptos: () => writeAptosDataToDB(userId),
        cosmos: () => fetchCosmosTokens(userId),
        hyperliquid: () => fetchAndSaveHyperliquidDataForAllWallets(userId),
        static: writeStaticDataToDB,
    }, report);
    const results = [...(evm.results || []), ...freeChainResults];
    const snapshot = results.some((result) => result.status === "success") ? await captureAfterRefresh(userId) : null;
    return { results, snapshot };
};

const queueRefresh = async (res, { userId, kind, walletIds = [], run }) => {
    const { job, reused } = await enqueueRefreshJob({ userId, kind, walletIds, run });
    return res.status(reused ? 200 : 202).json({
        ok: true,
        queued: !reused,
        message: reused ? "A matching refresh is already running" : "Refresh queued",
        job,
    });
};

router.get("/wallets", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const wallets = await WalletModel.findAll({
            where: {
                user_id: userId,
                chain: { [Op.in]: SUPPORTED_TRACKED_WALLET_CHAINS },
            },
            order: [["id", "ASC"]],
        });

        const approximateValues = await getWalletApproximateValues(userId);
        return res.json(wallets.map((wallet) => ({
            ...wallet.toJSON(),
            approximate_usd_value: approximateValues.byWalletId.get(wallet.id)?.totalUsd || 0,
            valuation: {
                source: approximateValues.source,
                captured_at: approximateValues.capturedAt,
                token_usd_value: approximateValues.byWalletId.get(wallet.id)?.tokenUsd || 0,
                protocol_usd_value: approximateValues.byWalletId.get(wallet.id)?.protocolUsd || 0,
                estimated_usd_value: approximateValues.byWalletId.get(wallet.id)?.estimatedUsd || 0,
                unpriced_asset_count: approximateValues.byWalletId.get(wallet.id)?.unpricedAssetCount || 0,
                pricing_methods: approximateValues.byWalletId.get(wallet.id)?.pricingMethods || [],
            },
        })));
    } catch (error) {
        console.error("Error fetching wallets:", error);
        return res.status(500).json({ error: "Failed to fetch wallets" });
    }
});

router.get("/debank/units", async (_req, res) => {
    try {
        const units = await fetchDebankData("/account/units", {}, { ttlMs: 60 * 1000 });
        return res.json({
            balance: Number(units.balance || 0),
            stats: Array.isArray(units.stats) ? units.stats.slice(0, 30) : [],
        });
    } catch (error) {
        console.error("Failed to fetch DeBank units:", error.message);
        return res.status(502).json({ error: "DeBank usage is temporarily unavailable" });
    }
});

router.post("/wallets", async (req, res) => {
    try {
        const userId = getUserId(req);
        const { tag, wallet, chain, show_chip, group_name, refresh_policy } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        if (!tag || !wallet || !chain) {
            return res.status(400).json({ error: "Tag, wallet, and chain are required" });
        }

        const newWallet = await WalletModel.create({
            tag,
            wallet,
            chain,
            show_chip,
            group_name: group_name?.trim() || null,
            refresh_policy: normalizeRefreshPolicy(refresh_policy),
            user_id: userId,
        });

        return res.status(201).json(newWallet);
    } catch (error) {
        console.error("Error adding wallet:", error);
        return res.status(500).json({ error: "Failed to add wallet" });
    }
});

router.put("/wallets/:id", async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { tag, wallet, chain, show_chip, group_name, refresh_policy } = req.body;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const existingWallet = await getOwnedWallet(id, userId);
        if (!existingWallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }

        if (tag !== undefined) {
            existingWallet.tag = tag;
        }
        if (wallet !== undefined) {
            existingWallet.wallet = wallet;
        }
        if (chain !== undefined) {
            existingWallet.chain = chain;
        }
        if (show_chip !== undefined) {
            existingWallet.show_chip = show_chip;
        }
        if (group_name !== undefined) {
            existingWallet.group_name = group_name?.trim() || null;
        }
        if (refresh_policy !== undefined) {
            existingWallet.refresh_policy = normalizeRefreshPolicy(refresh_policy, existingWallet.refresh_policy || "auto");
        }

        await existingWallet.save();
        return res.status(200).json(existingWallet);
    } catch (error) {
        console.error("Error updating wallet:", error);
        return res.status(500).json({ error: "Failed to update wallet" });
    }
});

router.delete("/wallets/:id", async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const wallet = await getOwnedWallet(id, userId);
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }

        await wallet.destroy();
        return res.status(200).json({ message: "Wallet deleted successfully" });
    } catch (error) {
        console.error("Error deleting wallet:", error);
        return res.status(500).json({ error: "Failed to delete wallet" });
    }
});

router.post("/wallets/refetch", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        return await queueRefresh(res, {
            userId,
            kind: "all_wallets",
            run: ({ report }) => refreshAllWallets({ userId, report }),
        });
    } catch (error) {
        console.error("Failed to queue full wallet refresh:", error);
        return res.status(500).json({ error: "Failed to queue wallet refresh" });
    }
});

router.post("/wallets/refetch/other", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        return await queueRefresh(res, {
            userId,
            kind: "other_wallets",
            run: ({ report }) => refreshOtherWallets({ userId, report }),
        });
    } catch (error) {
        console.error("Failed to queue non-EVM refresh:", error);
        return res.status(500).json({ error: "Failed to queue non-EVM refresh" });
    }
});

router.post("/wallets/refetch/evm", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        return await queueRefresh(res, {
            userId,
            kind: "all_evm_wallets",
            run: ({ report }) => refreshEvmWallets({ userId, report }),
        });
    } catch (error) {
        console.error("Failed to queue EVM refresh:", error);
        return res.status(500).json({ error: "Failed to queue EVM refresh" });
    }
});

router.get("/wallets/refetch/jobs/:jobId(\\d+)", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        const job = await getRefreshJob({ id: Number(req.params.jobId), userId });
        if (!job) return res.status(404).json({ error: "Refresh job not found" });
        return res.json({ job });
    } catch (error) {
        console.error("Failed to fetch refresh job:", error);
        return res.status(500).json({ error: "Failed to fetch refresh status" });
    }
});

router.post("/wallets/refetch/evm/:walletId(\\d+)", async (req, res) => {
    try {
        const userId = getUserId(req);
        const { walletId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const wallet = await getOwnedWallet(walletId, userId);
        if (!wallet || wallet.chain !== "evm") {
            return res.status(404).json({ error: "Wallet not found or not an EVM wallet" });
        }
        return await queueRefresh(res, {
            userId,
            kind: "selected_evm_wallets",
            walletIds: [wallet.id],
            run: ({ report }) => refreshEvmWallets({ userId, walletIds: [wallet.id], report }),
        });
    } catch (error) {
        console.error("Failed to queue EVM wallet refresh:", error);
        return res.status(500).json({ error: "Failed to queue EVM wallet refresh" });
    }
});

router.post("/wallets/refetch/evm/batch", async (req, res) => {
    try {
        const userId = getUserId(req);
        const requestedIds = [...new Set((req.body?.walletIds || []).map(Number).filter(Number.isInteger))].slice(0, 100);
        if (!userId) return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        if (!requestedIds.length) return res.status(400).json({ error: "Select at least one EVM wallet" });

        const wallets = await WalletModel.findAll({
            where: { id: { [Op.in]: requestedIds }, user_id: userId, chain: "evm" },
            order: [["id", "ASC"]],
        });
        if (!wallets.length) return res.status(404).json({ error: "No selected EVM wallets were found" });
        return await queueRefresh(res, {
            userId,
            kind: "selected_evm_wallets",
            walletIds: wallets.map((wallet) => wallet.id),
            run: ({ report }) => refreshSelectedEvmAndFreeChains({ userId, walletIds: wallets.map((wallet) => wallet.id), report }),
        });
    } catch (error) {
        console.error("Error refetching selected EVM wallets:", error);
        return res.status(500).json({ error: "Failed to refetch selected EVM wallets" });
    }
});

export default router;
