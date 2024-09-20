// api/wallets.js
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const result = await db.query('SELECT id, wallet, tag, chain FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching wallets', err);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
});

module.exports = router;