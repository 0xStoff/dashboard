// api/wallets.js
import express from 'express';
import {query} from '../db.js'; // Import the query function
import axios from 'axios';

const router = express.Router();

router.get('/wallets', async (req, res) => {
    try {
        const result = await query('SELECT id, wallet, tag, chain FROM wallets ORDER BY id'); // Use the imported query function
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching wallets', err);
        res.status(500).json({error: 'Failed to fetch wallets'});
    }
});


router.get('/fetch-coins', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
        const coins = response.data;

        for (const coin of coins) {
            const {id, name, symbol, platforms} = coin;

            // Insert coin information
            await query('INSERT INTO coins (id, name, symbol) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, symbol = EXCLUDED.symbol', [id, name, symbol]);

            // Handle platforms and contract addresses
            for (const [platform, contract_address] of Object.entries(platforms)) {
                let platformId;

                // Check if platform already exists
                const platformResult = await query('SELECT id FROM platforms WHERE name = $1', [platform]);
                if (platformResult.rows.length > 0) {
                    platformId = platformResult.rows[0].id;
                } else {
                    // Insert platform if it doesn't exist
                    const insertPlatformResult = await query('INSERT INTO platforms (name) VALUES ($1) RETURNING id', [platform]);
                    platformId = insertPlatformResult.rows[0].id;
                }

                // Insert the coin-platform relationship with contract address
                await query('INSERT INTO coin_platforms (coin_id, platform_id, contract_address) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, platformId, contract_address]);
            }
        }

        res.json({message: 'All coins and platforms fetched and stored successfully.'});
    } catch (err) {
        console.error('Error fetching and storing coins', err);
        res.status(500).json({error: 'Failed to fetch and store coins'});
    }
});

// Route to fetch and store top 100 coins from CoinGecko
// router.get('/fetch-coins', async (req, res) => {
//     try {
//
//             // const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1');
//             const response = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
//         const coins = response.data;
//
//         for (const coin of coins) {
//             const { id, name, symbol, platforms } = coin;
//             await query(
//                 'INSERT INTO coins (id, name, symbol) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, symbol = EXCLUDED.symbol',
//                 [id, name, symbol]
//             );
//
//             // Insert platforms for each coin
//             for (const [platform, address] of Object.entries(platforms)) {
//                 let platformId;
//
//                 // Check if platform exists, else insert it
//                 const platformResult = await query('SELECT id FROM platforms WHERE name = $1', [platform]);
//                 if (platformResult.rows.length > 0) {
//                     platformId = platformResult.rows[0].id;
//                 } else {
//                     const insertPlatformResult = await query('INSERT INTO platforms (name) VALUES ($1) RETURNING id', [platform]);
//                     platformId = insertPlatformResult.rows[0].id;
//                 }
//
//                 // Insert the coin-platform relationship
//                 await query(
//                     'INSERT INTO coin_platforms (coin_id, platform_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
//                     [id, platformId]
//                 );
//             }
//         }
//
//         res.json({ message: 'All coins and platforms fetched and stored successfully.' });
//     } catch (err) {
//         console.error('Error fetching and storing coins', err);
//         res.status(500).json({ error: 'Failed to fetch and store coins' });
//     }
// });

// Route to retrieve stored coins
// router.get('/coins', async (req, res) => {
//     try {
//         const result = await query('SELECT * FROM coins');
//         res.json(result.rows);
//     } catch (err) {
//         console.error('Error fetching coins from DB', err);
//         res.status(500).json({ error: 'Failed to fetch coins from DB' });
//     }
// });

router.get('/coins', async (req, res) => {
    try {
        const result = await query(`
            SELECT c.id, c.name, c.symbol, jsonb_object_agg(p.name, cp.contract_address) as platforms
            FROM coins c
                     LEFT JOIN coin_platforms cp ON c.id = cp.coin_id
                     LEFT JOIN platforms p ON cp.platform_id = p.id
            WHERE p.name IS NOT NULL
            GROUP BY c.id;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching coins from DB', err);
        res.status(500).json({error: 'Failed to fetch coins from DB'});
    }
});

// router.get('/contracts/ethereum', async (req, res) => {
//     try {
//         const result = await query(`
//             SELECT cp.contract_address
//             FROM coin_platforms cp
//                      LEFT JOIN platforms p ON cp.platform_id = p.id
//             WHERE p.name = 'ethereum';
//         `);
//
//         const contracts = result.rows.map(row => row.contract_address);
//         res.json(contracts);  // Array of contract addresses only
//
//     } catch (err) {
//         console.error('Error fetching Ethereum contracts', err);
//         res.status(500).json({error: 'Failed to fetch Ethereum contracts'});
//     }
// });

router.get('/coins/ethereum', async (req, res) => {
    try {
        const result = await query(`
            SELECT c.id, c.name, c.symbol, cp.contract_address
            FROM coins c
                     LEFT JOIN coin_platforms cp ON c.id = cp.coin_id
                     LEFT JOIN platforms p ON cp.platform_id = p.id
            WHERE p.name = 'ethereum' AND cp.contract_address IS NOT NULL AND cp.contract_address != '';
        `);

        res.json(result.rows);  // Detailed info including name, symbol, contract address

    } catch (err) {
        console.error('Error fetching Ethereum coin details', err);
        res.status(500).json({error: 'Failed to fetch Ethereum coin details'});
    }
});

export default router;