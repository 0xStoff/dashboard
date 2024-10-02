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

        // Restructure the data to flatten `amount` and `raw_amount` into each wallet object
        const result = tokens.map(token => {
            const modifiedWallets = token.wallets.map(wallet => {
                const { wallets_tokens, ...walletData } = wallet.get(); // Destructure to remove wallets_tokens

                return {
                    ...walletData, // Get all wallet attributes except wallets_tokens
                    amount: wallets_tokens.amount, // Flatten amount
                    raw_amount: wallets_tokens.raw_amount, // Flatten raw_amount
                };
            });

            return {
                ...token.get(), // Get all token attributes
                wallets: modifiedWallets, // Replace the nested Wallets array with the modified one
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

// router.get('/tokens/:walletId', async (req, res) => {
//     const { walletId } = req.params;
//
//     try {
//         const wallet = await Wallet.findOne({
//             where: { id: walletId },
//             include: [{
//                 model: Token,
//                 through: {
//                     model: WalletToken,
//                     attributes: ['amount', 'raw_amount'],
//                 },
//             }],
//         });
//
//         if (!wallet) {
//             return res.status(404).json({ error: `Wallet with id ${walletId} not found` });
//         }
//
//         res.json(wallet.tokens); // Return the tokens related to the wallet
//     } catch (err) {
//         console.error(`Error fetching tokens for wallet ${walletId}:`, err);
//         res.status(500).json({ error: `Failed to fetch tokens for wallet ${walletId}` });
//     }
// });
export default router;
