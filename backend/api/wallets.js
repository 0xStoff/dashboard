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

export default router;
