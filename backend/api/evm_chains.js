// /api/evm_chains.js
import {pool} from '../db.js';
import express from "express";

const router = express.Router();

router.get('/evm-chains', async (req, res) => {
    try {
        // Fetch chain data from the database
        const result = await pool.query('SELECT * FROM evm_chains');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching chains', err);
        res.status(500).json({error: 'Failed to fetch chains'});
    }
});

export default router;