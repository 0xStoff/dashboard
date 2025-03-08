import express from 'express';
import WalletModel from "../models/WalletModel.js";
import { fetchAndSaveEvmTokenDataForAllWallets } from "../token_data/evm_token_data.js";
import { fetchCosmosTokens } from "../token_data/cosmos_token_data.js";
import { writeAptosDataToDB, writeStaticDataToDB, writeSuiDataToDB } from "../token_data/sui_data.js";
import { fetchAndSaveSolTokenDataForAllWallets } from "../token_data/sol_token_data.js";

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const wallets = await WalletModel.findAll({
            order: [['id', 'ASC']]
        });
        res.json(wallets);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

router.post('/wallets', async (req, res) => {
    try {
        const { tag, wallet, chain, show_chip } = req.body;

        if (!tag || !wallet || !chain) {
            return res.status(400).json({ error: "Tag, wallet, and chain are required" });
        }

        const newWallet = await WalletModel.create({ tag, wallet, chain, show_chip });
        res.status(201).json(newWallet);
    } catch (err) {
        console.error('Error adding wallet:', err);
        res.status(500).json({ error: 'Failed to add wallet' });
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
                await fetchAndSaveEvmTokenDataForAllWallets();
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
export default router;