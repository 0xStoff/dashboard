import express from 'express';
import {fetchAndSaveEvmTokenData, fetchAndSaveEvmTokenDataForAllWallets} from "../token_data/evm_token_data.js";
import { fetchCosmosTokens } from "../token_data/cosmos_token_data.js";
import { writeAptosDataToDB, writeStaticDataToDB, writeSuiDataToDB } from "../token_data/sui_data.js";
import { fetchAndSaveSolTokenDataForAllWallets } from "../token_data/sol_token_data.js";
import WalletModel from "../models/WalletModel.js";

const router = express.Router();


router.get("/wallets", async (req, res) => {
    try {


        const userId = req.user?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized: Missing user ID" });
        }

        const wallets = await WalletModel.findAll({
            where: { user_id: userId },
            order: [["id", "ASC"]],
        });

        res.json(wallets);
    } catch (err) {
        console.error("Error fetching wallets:", err);
        res.status(500).json({ error: "Failed to fetch wallets" });
    }
});

router.post("/wallets", async (req, res) => {
    try {
        const { tag, wallet, chain, show_chip } = req.body;

        if (!tag || !wallet || !chain) {
            return res.status(400).json({ error: "Tag, wallet, and chain are required" });
        }

        const newWallet = await WalletModel.create({
            tag,
            wallet,
            chain,
            show_chip,
            user_id: req.user.user.id,
        });

        res.status(201).json(newWallet);
    } catch (err) {
        console.error("Error adding wallet:", err);
        res.status(500).json({ error: "Failed to add wallet" });
    }
});
router.put('/wallets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { tag, show_chip } = req.body;

        const wallet = await WalletModel.findByPk(id);
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }

        if (tag !== undefined) wallet.tag = tag;
        if (show_chip !== undefined) wallet.show_chip = show_chip;

        await wallet.save();
        res.status(200).json(wallet);
    } catch (err) {
        console.error('Error updating wallet:', err);
        res.status(500).json({ error: 'Failed to update wallet' });
    }
});

router.delete('/wallets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const wallet = await WalletModel.findByPk(id);

        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }

        await wallet.destroy();
        res.status(200).json({ message: "Wallet deleted successfully" });
    } catch (err) {
        console.error('Error deleting wallet:', err);
        res.status(500).json({ error: 'Failed to delete wallet' });
    }
});


router.post('/wallets/refetch', async (req, res) => {
    try {
        console.log("🔄 Refetching wallet data...");

        await Promise.all([
            (async () => {
                console.log("Fetching other token data...");
                await writeStaticDataToDB();
                await writeAptosDataToDB();
                await writeSuiDataToDB();
                await fetchAndSaveSolTokenDataForAllWallets();
                await fetchCosmosTokens();
                console.log("✅ Other token data fetched");
            })(),
            (async () => {
                console.log("Fetching EVM token data...");
                await fetchAndSaveEvmTokenDataForAllWallets(req);
                console.log("✅ EVM token data fetched");
            })()
        ]);

        console.log("🎉 All Token Data Fetched Successfully!");

        res.status(200).json({
            message: "✅ Wallet data refetched successfully!"
        });
    } catch (err) {
        console.error("❌ Error executing token data functions:", err);
        res.status(500).json({ error: "Failed to refetch wallet data", details: err.message });
    }
});

router.post('/wallets/refetch/other', async (req, res) => {
    try {
        console.log("🔄 Refetching other token data...");

        await Promise.all([
            writeStaticDataToDB(),
            writeAptosDataToDB(),
            writeSuiDataToDB(),
            fetchAndSaveSolTokenDataForAllWallets(),
            fetchCosmosTokens()
        ]);

        console.log("✅ Other token data fetched successfully!");
        res.status(200).json({ message: "✅ Other token data refetched successfully!" });
    } catch (err) {
        console.error("❌ Error refetching other token data:", err);
        res.status(500).json({ error: "Failed to refetch other token data", details: err.message });
    }
});

router.post('/wallets/refetch/evm', async (req, res) => {
    try {
        console.log("🔄 Refetching EVM token data for all wallets...");

        await fetchAndSaveEvmTokenDataForAllWallets(req);

        console.log("✅ EVM token data for all wallets fetched successfully!");
        res.status(200).json({ message: "✅ EVM token data for all wallets refetched successfully!" });
    } catch (err) {
        console.error("❌ Error refetching EVM token data for all wallets:", err);
        res.status(500).json({ error: "Failed to refetch EVM token data", details: err.message });
    }
});

router.post('/wallets/refetch/evm/:walletId', async (req, res) => {
    try {
        const { walletId } = req.params;
        const wallet = await WalletModel.findByPk(walletId);

        if (!wallet || wallet.chain !== 'evm') {
            return res.status(404).json({ error: "Wallet not found or not an EVM wallet" });
        }

        console.log(`🔄 Refetching EVM token data for wallet ID: ${walletId}`);

        await fetchAndSaveEvmTokenData(wallet.id, wallet.wallet);

        console.log(`✅ EVM token data fetched successfully for wallet ID: ${walletId}`);
        res.status(200).json({ message: `✅ EVM token data refetched for wallet ID: ${walletId}` });
    } catch (err) {
        console.error("❌ Error refetching EVM token data for wallet:", err);
        res.status(500).json({ error: "Failed to refetch EVM token data", details: err.message });
    }
});
export default router;