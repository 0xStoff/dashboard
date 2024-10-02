// /api/chains.js
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { pool } from '../db.js';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_DIR = path.join(__dirname, '../logos');

if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR);
}

const downloadLogo = async (logoUrl, chainId) => {
    const logoPath = path.join(LOGO_DIR, `${chainId}.png`);
    const writer = fs.createWriteStream(logoPath);

    const response = await axios({
        url: logoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(logoPath));
        writer.on('error', reject);
    });
};

// Function to create router and pass ACCESS_KEY
const createChainsRouter = (ACCESS_KEY) => {
    // Route to fetch chain data from Debank and store it in the database
    router.get('/update-chains', async (req, res) => {
        try {
            const response = await axios.get('https://pro-openapi.debank.com/v1/chain/list', {
                headers: {
                    accept: 'application/json',
                    AccessKey: ACCESS_KEY,
                },
            });

            const chains = response.data;

            for (const chain of chains) {
                let logoPath = null;
                try {
                    logoPath = await downloadLogo(chain.logo_url, chain.id);
                } catch (error) {
                    console.error(`Error downloading logo for chain ${chain.id}:`, error);
                }

                await pool.query(
                    `INSERT INTO chains (chain_id, name, native_token_id, wrapped_token_id, logo_path)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (chain_id)
                    DO UPDATE SET name = $2, native_token_id = $3, wrapped_token_id = $4, logo_path = $5`,
                    [chain.id, chain.name, chain.native_token_id, chain.wrapped_token_id, logoPath]
                );
            }

            res.status(200).json({ message: 'Chain data updated successfully' });
        } catch (error) {
            console.error('Error updating chains:', error);
            res.status(500).json({ error: 'Failed to update chains' });
        }
    });

    // Route to fetch chain data from the database
    router.get('/chains', async (req, res) => {
        try {
            // Fetch chain data from the database
            const result = await pool.query('SELECT * FROM chains');
            res.json(result.rows);
        } catch (err) {
            console.error('Error fetching chains', err);
            res.status(500).json({ error: 'Failed to fetch chains' });
        }
    });

    return router;
};

export default createChainsRouter;