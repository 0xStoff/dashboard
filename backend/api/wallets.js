import express from 'express';
import { fetchWalletData } from "./utils.js";

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const { chain, usd_value } = req.query;
        const wallets = await fetchWalletData(chain, usd_value);

        res.json(wallets);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});


// router.get('/wallets/:walletId', async (req, res) => {
//     const {walletId} = req.params;
//
//     try {
//         const wallet = await WalletModel.findOne({
//             where: {id: walletId}, include: [{
//                 model: TokenModel, through: {
//                     model: WalletTokenModel, attributes: ['amount', 'raw_amount', 'usd_value'],
//                 }, attributes: ['id', 'name', 'symbol', 'decimals', 'price', 'logo_path', 'chain_id'],
//             }],
//         });
//
//         if (!wallet) {
//             return res.status(404).json({error: `Wallet with id ${walletId} not found`});
//         }
//
//         const result = flattenSingleWallet(wallet);
//
//
//         res.json(result);
//     } catch (err) {
//         console.error(`Error fetching tokens for wallet ${walletId}:`, err);
//         res.status(500).json({error: `Failed to fetch tokens for wallet ${walletId}`});
//     }
// });
export default router;
