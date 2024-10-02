// api/wallets.js
import express from 'express';
import Wallet from "../models/Wallet.js";
import Token from "../models/Token.js";
import WalletToken from "../models/WalletToken.js";

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const {chain} = req.query;
        const whereClause = chain ? {chain} : undefined;

        const wallets = await Wallet.findAll({
            where: whereClause, include: [{
                model: Token, through: {
                    model: WalletToken, attributes: ['amount', 'raw_amount'],
                }, attributes: ['name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
            }], order: [['id', 'ASC']],
        });

        res.json(wallets);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({error: 'Failed to fetch wallets'});
    }
});
router.get('/wallets/:walletId', async (req, res) => {
    const {walletId} = req.params;

    try {
        const wallet = await Wallet.findOne({
            where: {id: walletId}, include: [{
                model: Token, through: {
                    model: WalletToken, attributes: ['amount', 'raw_amount'],
                },
            }],
        });

        if (!wallet) {
            return res.status(404).json({error: `Wallet with id ${walletId} not found`});
        }

        res.json(wallet); // Return the tokens related to the wallet
    } catch (err) {
        console.error(`Error fetching tokens for wallet ${walletId}:`, err);
        res.status(500).json({error: `Failed to fetch tokens for wallet ${walletId}`});
    }
});
export default router;
