import express from "express";
import TokenModel from "../models/TokenModel.js";

const router = express.Router();

router.get('/tokens', async (req, res) => {
    try {
        // const tokens = await TokenModel.findAll({
        //     include: [{
        //         model: WalletModel,
        //         through: {
        //             model: WalletTokenModel,
        //             attributes: ['amount', 'raw_amount'],
        //         },
        //         attributes: ['wallet'],
        //     }],
        //     order: [['name', 'ASC']],
        // });
        //
        // const result = tokens.map(token => {
        //     const modifiedWallets = token.wallets.map(wallet => {
        //         const { wallets_tokens, ...walletData } = wallet.get();
        //
        //         return {
        //             ...walletData,
        //             amount: wallets_tokens.amount,
        //             raw_amount: wallets_tokens.raw_amount,
        //         };
        //     });
        //
        //     return {
        //         ...token.get(),
        //         wallets: modifiedWallets,
        //     };
        // });

        const tokens = await TokenModel.findAll({
            order: [['id', 'ASC']],
        });

        res.json(tokens);
    } catch (err) {
        console.error('Error fetching tokens:', err);
        res.status(500).json({ error: 'Failed to fetch tokens' });
    }
});

export default router;
