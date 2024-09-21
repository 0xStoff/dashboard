// api/wallets.js
import express from 'express';
import { query } from '../db.js'; // Import the query function

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const result = await query('SELECT id, wallet, tag, chain FROM users ORDER BY id'); // Use the imported query function
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching wallets', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;