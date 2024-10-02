// api/wallets.js
import express from 'express';
import {query} from '../db.js'; // Import the query function

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        // Get chain type from query parameters (optional)
        const { chain } = req.query;

        // SQL query that filters by chain type if provided
        let queryText = 'SELECT id, wallet, tag, chain FROM wallets';
        const queryParams = [];

        // Append WHERE clause if chain filter is present
        if (chain) {
            queryText += ' WHERE chain = $1';
            queryParams.push(chain);
        }

        queryText += ' ORDER BY id';

        // Execute query with or without chain filter
        const result = await query(queryText, queryParams);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching wallets', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

export default router;