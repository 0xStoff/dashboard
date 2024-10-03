// /api/non_evm_chains.js
import express from 'express';
import NonEvmChains from "../models/NonEvmChainsModel.js";

const router = express.Router();

router.get('/non-evm-chains', async (req, res) => {
    try {
        const nonEvmChains = await NonEvmChains.findAll({
            order: [['chain_id', 'ASC']],
        });
        res.json(nonEvmChains);
    } catch (err) {
        console.error('Error fetching non-EVM chains', err);
        res.status(500).json({error: 'Failed to fetch non-EVM chains'});
    }
});

export default router;
