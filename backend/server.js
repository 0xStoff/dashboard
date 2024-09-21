// server.js
import express from 'express';
import cors from 'cors';
import walletRoutes from './api/wallets.js';

const app = express();

const corsOptions = {
    origin: 'http://localhost:8080', // Allow only this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};

app.use(cors(corsOptions)); // Enable CORS with options
app.use(express.json());

app.use('/api', walletRoutes);

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});