// /api/evm_chains.js
import express from "express";
import EvmChains from "../models/EvmChains.js";

const router = express.Router();


router.get('/evm-chains', async (req, res) => {
    try {
        const evmChains = await EvmChains.findAll({
            order: [['chain_id', 'ASC']],
        });
        res.json(evmChains);
    } catch (err) {
        console.error('Error fetching chains', err);
        res.status(500).json({ error: 'Failed to fetch chains' });
    }
});

export default router;

// router.get('/evm-chains', async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM evm_chains');
//         res.json(result.rows);
//     } catch (err) {
//         console.error('Error fetching chains', err);
//         res.status(500).json({error: 'Failed to fetch chains'});
//     }
// });

