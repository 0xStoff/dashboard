const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');


db.run(`CREATE TABLE IF NOT EXISTS coins (
    id TEXT PRIMARY KEY,
    name TEXT,
    symbol TEXT,
    platforms TEXT
)`);

async function fetchAndStoreCoin(id) {
    const coin = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}?localization=false`);
    const { name, symbol, platforms } = coin.data;

    db.run(`INSERT INTO coins (id, name, symbol, platforms) VALUES (?, ?, ?, ?)`, [id, name, symbol, JSON.stringify(platforms)], (err) => {
        if (err) return console.error(err);
        console.log(`Coin ${name} stored in DB`);
    });
}

fetchAndStoreCoin('ethereum');