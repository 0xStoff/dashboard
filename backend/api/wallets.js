import express from 'express';
import WalletModel from "../models/WalletModel.js";

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

export default router;