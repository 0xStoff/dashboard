// server.js
import express from 'express';
import cors from 'cors';
import walletRoutes from './api/wallets.js';
import createChainsRouter from './api/chains.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();

const corsOptions = {
    origin: 'http://localhost:8080', // Allow only this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

app.use(cors(corsOptions)); // Enable CORS with options
app.use(express.json());

app.use('/api', walletRoutes);

// Pass ACCESS_KEY to chains.js
const ACCESS_KEY = process.env.RABBY_ACCESS_KEY;
app.use('/api', createChainsRouter(ACCESS_KEY)); // Chain routes with ACCESS_KEY

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});