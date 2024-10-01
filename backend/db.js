// db.js
import pkg from 'pg';
const { Pool } = pkg;

// Replace these values with your actual DB configuration
const pool = new Pool({
    user: 'stoff',
    host: 'localhost',
    database: 'crypto_dashboard',
    password: 'abc123',
    port: 5432,
});


export const query = (text, params) => {
    return pool.query(text, params);
};