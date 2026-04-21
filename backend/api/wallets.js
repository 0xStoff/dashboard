import express from "express";
import { Op } from "sequelize";
import {
    fetchAndSaveEvmTokenData,
    fetchAndSaveEvmTokenDataForAllWallets,
    fetchAndSaveSolTokenDataForAllWallets,
    fetchCosmosTokens,
    writeAptosDataToDB,
    writeStaticDataToDB,
    writeSuiDataToDB,
} from "../token_data/index.js";
import WalletModel from "../models/WalletModel.js";
import { SUPPORTED_TRACKED_WALLET_CHAINS } from "../config/supportedChains.js";

const router = express.Router();

const getUserId = (req) => req.user?.user?.id;

const getOwnedWallet = async (walletId, userId) =>
    WalletModel.findOne({
        where: {
            id: walletId,
            user_id: userId,
        },
    });

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
    try {
        console.log("Refetching wallet data...");

        await Promise.all([
            (async () => {
                console.log("Fetching non-EVM and static token data...");
                await writeStaticDataToDB();
                await writeAptosDataToDB();
                await writeSuiDataToDB();
                await fetchAndSaveSolTokenDataForAllWallets();
                await fetchCosmosTokens();
                console.log("Non-EVM and static token data fetched");
            })(),
            (async () => {
                console.log("Fetching EVM token data...");
                await fetchAndSaveEvmTokenDataForAllWallets(req);
                console.log("EVM token data fetched");
            })(),
        ]);

        return res.status(200).json({
            message: "Wallet data refetched successfully",
        });
    } catch (error) {
        console.error("Error executing token data functions:", error);
        return res.status(500).json({
            error: "Failed to refetch wallet data",
            details: error.message,
        });
    }
});

router.post("/wallets/refetch/other", async (_req, res) => {
    try {
        console.log("Refetching non-EVM and static token data...");

        await Promise.all([
            writeStaticDataToDB(),
            writeAptosDataToDB(),
            writeSuiDataToDB(),
            fetchAndSaveSolTokenDataForAllWallets(),
            fetchCosmosTokens(),
        ]);

        return res.status(200).json({ message: "Other token data refetched successfully" });
    } catch (error) {
        console.error("Error refetching other token data:", error);
        return res.status(500).json({
            error: "Failed to refetch other token data",
            details: error.message,
        });
    }
});

router.post("/wallets/refetch/evm", async (req, res) => {
    try {
        console.log("Refetching EVM token data for all wallets...");
        await fetchAndSaveEvmTokenDataForAllWallets(req);
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

        await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet, req);
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
