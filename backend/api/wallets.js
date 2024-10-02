// api/wallets.js
import express from 'express';
import Wallet from "../models/Wallet.js";

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const { chain } = req.query;
        const whereClause = chain ? { chain } : undefined;

        const wallets = await Wallet.findAll({
            where: whereClause,
            order: [['id', 'ASC']],
        });

        res.json(wallets);
    } catch (err) {
        console.error('Error fetching wallets:', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;


// router.get('/wallets', async (req, res) => {
//     try {
//         const { chain } = req.query;
//
//         let queryText = 'SELECT id, wallet, tag, chain FROM wallets';
//         const queryParams = [];
//
//         if (chain) {
//             queryText += ' WHERE chain = $1';
//             queryParams.push(chain);
//         }
//
//         queryText += ' ORDER BY id';
//
//         const result = await query(queryText, queryParams);
//
//         res.json(result.rows);
//     } catch (err) {
//         console.error('Error fetching wallets', err);
//         res.status(500).json({ error: 'Failed to fetch wallets' });
//     }
// });