import express from "express";
import { Op } from "sequelize";
import {
    fetchAndSaveEvmTokenData,
    fetchAndSaveEvmTokenDataForAllWallets,
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

const router = express.Router();

const getUserId = (req) => req.user?.user?.id;

const getOwnedWallet = async (walletId, userId) =>
    WalletModel.findOne({
        where: {
            id: walletId,
            user_id: userId,
        },
    });

const runRefreshTasks = async (tasks) => Promise.all(
    Object.entries(tasks).map(async ([provider, task]) => {
        try {
            const details = await task();
            if (details?.skipped) return { provider, status: "skipped", details };
            return { provider, status: "success", details: details || null };
        } catch (error) {
            console.error(`${provider} refetch failed:`, error.message);
            return { provider, status: "failed", error: error.message };
        }
    })
);

const sendRefreshResults = (res, results, successMessage) => {
    const failures = results.filter((result) => result.status === "failed");
    const skipped = results.filter((result) => result.status === "skipped");
    const message = failures.length
        ? `Refetch completed with ${failures.length} provider failure${failures.length === 1 ? "" : "s"}`
        : skipped.length ? `${successMessage} (${skipped.length} optional provider skipped)` : successMessage;

    return res.status(failures.length ? 207 : 200).json({
        ok: failures.length === 0,
        message,
        results,
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

        return res.json(wallets);
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
        const { tag, wallet, chain, show_chip } = req.body;

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
        const { tag, wallet, chain, show_chip } = req.body;

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
    console.log("Refetching wallet data...");
    const userId = getUserId(req);
    const results = await runRefreshTasks({
        evm: () => fetchAndSaveEvmTokenDataForAllWallets(req),
        solana: () => fetchAndSaveSolTokenDataForAllWallets(userId),
        sui: () => writeSuiDataToDB(userId),
        aptos: () => writeAptosDataToDB(userId),
        cosmos: () => fetchCosmosTokens(userId),
        hyperliquid: () => fetchAndSaveHyperliquidDataForAllWallets(userId),
        static: writeStaticDataToDB,
    });
    return sendRefreshResults(res, results, "Wallet data refetched successfully");
});

router.post("/wallets/refetch/other", async (req, res) => {
    console.log("Refetching non-EVM and static token data...");
    const userId = getUserId(req);
    const results = await runRefreshTasks({
        solana: () => fetchAndSaveSolTokenDataForAllWallets(userId),
        sui: () => writeSuiDataToDB(userId),
        aptos: () => writeAptosDataToDB(userId),
        cosmos: () => fetchCosmosTokens(userId),
        hyperliquid: () => fetchAndSaveHyperliquidDataForAllWallets(userId),
        static: writeStaticDataToDB,
    });
    return sendRefreshResults(res, results, "Other token data refetched successfully");
});

router.post("/wallets/refetch/evm", async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }
        console.log("Refetching EVM token data for all wallets...");
        await Promise.all([
            fetchAndSaveEvmTokenDataForAllWallets(req),
            fetchAndSaveHyperliquidDataForAllWallets(userId),
        ]);
        return res.status(200).json({ message: "EVM token data for all wallets refetched successfully" });
    } catch (error) {
        console.error("Error refetching EVM token data for all wallets:", error);
        return res.status(500).json({
            error: "Failed to refetch EVM token data",
            details: error.message,
        });
    }
});

router.post("/wallets/refetch/evm/:walletId", async (req, res) => {
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

        await Promise.all([
            fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, req, { forceTokens: true }),
            fetchAndSaveHyperliquidData(wallet),
        ]);
        return res.status(200).json({ message: "EVM token data refetched successfully" });
    } catch (error) {
        console.error("Error refetching EVM token data for wallet:", error);
        return res.status(500).json({
            error: "Failed to refetch EVM token data",
            details: error.message,
        });
    }
});

export default router;
