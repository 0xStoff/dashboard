import express from 'express';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import * as querystring from "querystring";
import crypto from 'crypto';


// Load environment variables
dotenv.config();

const router = express.Router();

/**
 * Helper function to create a Binance signature
 * @param {string} queryString - The query string for the API request.
 * @param {string} secret - The Binance API secret.
 * @returns {string} - The HMAC SHA256 signature.
 */
const createBinanceSignature = (queryString, secret) => {
    return CryptoJS.HmacSHA256(queryString, secret).toString();
};

/**
 * Fetch Binance data utility function
 * @param {string} endpoint - Binance API endpoint.
 * @param {string} apiKey - Binance API key.
 * @param {string} apiSecret - Binance API secret.
 * @param {object} params - Query parameters for the API request.
 * @returns {Promise<object>} - The API response data.
 */
const fetchBinanceData = async (endpoint, apiKey, apiSecret, params) => {
    try {
        const queryString = new URLSearchParams(params).toString();
        const signature = createBinanceSignature(queryString, apiSecret);

        const headers = {'X-MBX-APIKEY': apiKey};
        const response = await axios.get(`https://api.binance.com${endpoint}?${queryString}&signature=${signature}`, {
            headers,
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching Binance data from ${endpoint}:`, error.response?.data || error.message);
        throw error.response?.data || error.message;
    }
};

// Binance Fiat Payments Endpoint
router.get('/binance/fiat-payments', async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    const transactionType = req.query.transactionType || 0;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({error: 'Missing API key or secret'});
    }

    const params = {
        transactionType, beginTime: new Date('2020-01-01').getTime(), endTime: Date.now(), timestamp: Date.now(),
    };

    try {
        const data = await fetchBinanceData('/sapi/v1/fiat/payments', apiKey, apiSecret, params);
        const completedPayments = (data.data || []).filter(order => order.status === 'Completed');
        res.json(completedPayments);
    } catch (error) {
        res.status(500).json({error: 'Failed to fetch Binance fiat payments', details: error});
    }
});

// Binance Fiat Orders Endpoint
router.get('/binance/fiat-orders', async (req, res) => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_API_SECRET;
    const transactionType = req.query.transactionType || 0;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({error: 'Missing API key or secret'});
    }

    const params = {
        transactionType, beginTime: new Date('2020-01-01').getTime(), endTime: Date.now(), timestamp: Date.now(),
    };

    try {
        const data = await fetchBinanceData('/sapi/v1/fiat/orders', apiKey, apiSecret, params);
        const successfulOrders = (data.data || []).filter(order => order.status === 'Successful');
        res.json(successfulOrders);
    } catch (error) {
        res.status(500).json({error: 'Failed to fetch Binance fiat orders', details: error});
    }
});

/**
 * Generate Kraken API signature.
 * @param {string} urlPath - The Kraken API endpoint path.
 * @param {string|object} data - The request payload.
 * @param {string} secret - The Kraken API secret.
 * @returns {string} - The API signature.
 */
function getKrakenSignature(urlPath, data, secret) {
    let encoded;

    if (typeof data === 'string') {
        const jsonData = JSON.parse(data);
        encoded = jsonData.nonce + data;
    } else if (typeof data === 'object') {
        const dataStr = querystring.stringify(data);
        encoded = data.nonce + dataStr;
    } else {
        throw new Error('Invalid data type');
    }

    const sha256Hash = crypto.createHash('sha256').update(encoded).digest();
    const message = urlPath + sha256Hash.toString('binary');
    const secretBuffer = Buffer.from(secret, 'base64');
    const hmac = crypto.createHmac('sha512', secretBuffer);
    hmac.update(message, 'binary');
    return hmac.digest('base64');
}

/**
 * Fetch all Kraken ledgers for a specific asset with pagination.
 * @param {string} apiKey - The Kraken API key.
 * @param {string} apiSecret - The Kraken API secret.
 * @param {string} asset - The asset to fetch (e.g., "CHF", "EUR").
 * @returns {Promise<object[]>} - An array of all ledger entries.
 */
async function fetchKrakenLedgers(apiKey, apiSecret, asset, type) {
    const now = Math.floor(Date.now() / 1000);
    const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60; // Approximation of 5 years in seconds
    const allLedgers = [];
    let offset = 0;

    while (true) {
        const nonce = Date.now().toString();
        const data = JSON.stringify({
            nonce, asset, type, start: fiveYearsAgo, end: now, ofs: offset,
        });

        const signature = getKrakenSignature('/0/private/Ledgers', data, apiSecret);

        const config = {
            method: 'post', url: 'https://api.kraken.com/0/private/Ledgers', headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'API-Key': apiKey,
                'API-Sign': signature,
            }, data,
        };

        const response = await axios.request(config);

        // Handle the response
        const result = response.data?.result?.ledger || {};
        const ledgerEntries = Object.values(result);

        if (ledgerEntries.length === 0) {
            break; // Exit loop if no more records are found
        }

        allLedgers.push(...ledgerEntries);

        // Update offset for the next batch
        offset += ledgerEntries.length;
    }

    return allLedgers;
}


// Route to fetch ledgers for CHF and EUR
router.get('/kraken/ledgers', async (req, res) => {
    const apiKey = process.env.KRAKEN_API_KEY;
    const apiSecret = process.env.KRAKEN_API_SECRET;
    const asset = req.query.asset;
    const types = req.query.type ? req.query.type.split(',') : ['deposit', 'withdrawal', 'trade', 'staking', 'transfer', 'earn', 'spend', 'adjustment'];

    if (!apiKey || !apiSecret) {
        return res.status(400).json({error: 'Missing API key or secret'});
    }

    try {
        const results = [];
        for (const type of types) {
            const ledgers = await fetchKrakenLedgers(apiKey, apiSecret, asset, type);
            results.push(...ledgers);
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching Kraken ledgers:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to fetch Kraken ledgers', details: error.response?.data || error.message,
        });
    }
});

router.get('/gnosispay/transactions', async (req, res) => {
    try {
        const response = await axios.get("https://app.gnosispay.com/api/v1/transactions", {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Cookie: "__Host-authjs.csrf-token=b13b6a8dbee444f7a53ffd86e475ebc7d3b44490bcad4b044c94b5f93c02a773%7C3d6377fd82290af12621e282f7bb59f9e32ae3e4ed74526fc02c7d763100ba70; intercom-device-id-uea1gb6g=09409d5a-c7c0-46c8-bf0d-5332a0b23cf1; __Secure-authjs.callback-url=https%3A%2F%2Fapp.gnosispay.com%2F; jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHdjNjFjZ2EwMDQ4Nno5NWp0OW5oMXUxIiwic2lnbmVyQWRkcmVzcyI6IjB4MDdmQUYxQTAxMTczMzQ1MTdiODI2NDU0MkY3RUExOGY1QWNiYjhFZSIsImhhc1NpZ25lZFVwIjp0cnVlLCJpYXQiOjE3MzQzNjc3MjYsImV4cCI6MTczNDM3MTMyNn0.8yP5TPlECBHgSk00hKz0PByo4MrK5sgA9PBUZqkop74; spdl_pid=U6FUQGaPuqBdUqynObjwejle3xvuK8Cj; cookie_consent=yes; intercom-session-uea1gb6g=U2VHRi9mUkllTG5WTVc0VlJiNFlOa3p0RWMvbW9GZFhiMW16c3Zrd2hpRG9NMWhVMmtUYmR5cFhqNFQzY01rYS0tWk4wOVJ2SklXZE5vNG9PUHg4UTFGUT09--51ec8bdca12272708be3f0e648cc319955dce637; ph_phc_8faG3nSN9klsZ4BMOa7IJckdzxMaNqBNeevqgSGOrgF_posthog=%7B%22distinct_id%22%3A%22clwc61cga00486z95jt9nh1u1%22%2C%22%24sesid%22%3A%5B1736251230447%2C%22019440a1-d4a9-7e71-9e3b-862a9a1dbec1%22%2C1736251135145%5D%2C%22%24epp%22%3Atrue%7D; __Secure-authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoielY1QzhwVG5zMlNZSmJsVVd0aXhuQ1FKVFJueW1DaUw4dHJWWTNaNnVwNjJfb1ZvRFliVmJRUkNweWdQbVJtRWNfRlYtRzFfeEpLZEFYNGNhY2hVV1EifQ..D8vIrVSFbwzDICM4zstLHg.LaQj-TCKtat3mGuyP_WH8X7VRT0KterwbDMho_SMLAGM0BGgSb2OQZFPyllXI9G4WbuDbJ5z7xrAwUy5LcxNTQm-37YIqzWFeBx_sqxouUxtgWvVIVzNIoVSFHKHOpCdp9XxCGsuetZ5ajWhJlkbGtJtGmHc4_mL9CC5fRKtBteaVLEUYiyp9vJmvuuAopDfv5p_ewRzh9YUN6VbE3k1lWFUAy0gaeciTb8JgQF0yqa-SRErQ9zbeDWcetPKiSr7ePHnHjnhh1PCKWk2FuZyzOUf1emeff_BetXU7y2-K5Y3WoC2LfdY98QFIocM7NyL.CAQ2aioDlDQ0L1eeOLbaCG2f4UkgvlzN9IxhHZ_Yfas",
            },
        });

        // Send the fetched data back as JSON
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching Gnosis Pay transactions:", error.message);
        res.status(500).json({
            error: "Failed to fetch Gnosis Pay transactions",
            details: error.message,
        });
    }
});

export default router;