import {pool} from "../db.js";
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
                    attributes: ['amount', 'raw_amount'], // Include amount and raw_amount
                },
                attributes: ['wallet'], // Include wallet address
            }],
            order: [['name', 'ASC']], // Order by token name
        });

        res.json(tokens);
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

router.get('/tokens/:walletId', async (req, res) => {
    const { walletId } = req.params;

    try {
        const wallet = await Wallet.findOne({
            where: { id: walletId },
            include: [{
                model: Token,
                through: {
                    model: WalletToken,
                    attributes: ['amount', 'raw_amount'],
                },
            }],
        });

        if (!wallet) {
            return res.status(404).json({ error: `Wallet with id ${walletId} not found` });
        }

        res.json(wallet.tokens); // Return the tokens related to the wallet
    } catch (err) {
        console.error(`Error fetching tokens for wallet ${walletId}:`, err);
        res.status(500).json({ error: `Failed to fetch tokens for wallet ${walletId}` });
    }
});
export default router;

// router.get('/tokens/:wallet', async (req, res) => {
//     const { wallet } = req.params;
//
//     try {
//         const walletData = await Wallet.findOne({
//             where: { wallet },  // Find by wallet address
//             include: [{
//                 model: Token,
//                 through: {
//                     model: WalletToken,
//                     attributes: ['amount', 'raw_amount'],
//                 },
//             }],
//         });
//
//         if (!walletData) {
//             return res.status(404).json({ error: `Wallet with address ${wallet} not found` });
//         }
//
//         res.json(walletData.Tokens);
//     } catch (err) {
//         console.error(`Error fetching tokens for wallet ${wallet}:`, err);
//         res.status(500).json({ error: `Failed to fetch tokens for wallet ${wallet}` });
//     }
// });

// router.get('/tokens', async (req, res) => {
//     try {
//         const queryText = `
//             SELECT t.id,
//                    t.chain_id,
//                    t.name,
//                    t.symbol,
//                    t.decimals,
//                    t.price,
//                    t.logo_path,
//                    wt.amount,
//                    wt.raw_amount,
//                    w.wallet
//             FROM tokens t
//                      JOIN wallets_tokens wt ON t.id = wt.token_id
//                      JOIN wallets w ON w.id = wt.wallet_id
//             ORDER BY t.name;
//         `;
//
//         const result = await pool.query(queryText);
//         res.json(result.rows);
//     } catch (err) {
//         console.error('Error fetching tokens:', err);
//         res.status(500).json({error: 'Failed to fetch tokens'});
//     }
// });
//
// router.get('/tokens/:walletId', async (req, res) => {
//     const {walletId} = req.params;
//
//     try {
//         const queryText = `
//             SELECT t.id,
//                    t.chain_id,
//                    t.name,
//                    t.symbol,
//                    t.decimals,
//                    t.price,
//                    t.logo_path,
//                    wt.amount,
//                    wt.raw_amount,
//                    w.wallet
//             FROM tokens t
//                      JOIN wallets_tokens wt ON t.id = wt.token_id
//                      JOIN wallets w ON w.id = wt.wallet_id
//             WHERE w.id = $1
//             ORDER BY t.name;
//         `;
//
//         const result = await pool.query(queryText, [walletId]);
//         res.json(result.rows);
//     } catch (err) {
//         console.error(`Error fetching tokens for wallet ${walletId}:`, err);
//         res.status(500).json({error: `Failed to fetch tokens for wallet ${walletId}`});
//     }
// });
