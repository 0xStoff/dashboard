// db.js
import {Pool} from 'pg';

// Replace these values with your actual DB configuration
const pool = new Pool({
    user: 'stoff',
    host: 'localhost',
    database: 'crypto_dashboard',
    password: '',
    port: 5432,
});

export function query(text, params) {
    return pool.query(text, params);
}