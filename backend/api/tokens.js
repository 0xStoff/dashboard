import express from "express";
import Wallet from "../models/Wallet.js";
import WalletToken from "../models/WalletToken.js";
import Token from "../models/Token.js";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        const tokens = await Token.findAll({
            include: [{
                model: Wallet,
                through: {
                    model: WalletToken,
                    attributes: ['amount', 'raw_amount'],
                },
                attributes: ['wallet'],
            }],
            order: [['name', 'ASC']],
        });

        const result = tokens.map(token => {
            const modifiedWallets = token.wallets.map(wallet => {
                const { wallets_tokens, ...walletData } = wallet.get();

                return {
                    ...walletData,
                    amount: wallets_tokens.amount,
                    raw_amount: wallets_tokens.raw_amount,
                };
            });

            return {
                ...token.get(),
                wallets: modifiedWallets,
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

export default router;
