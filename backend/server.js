// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import walletRoutes from "./api/wallets.js";
import chainsRoutes, {updateChainsData} from "./api/chains.js";

dotenv.config();

const app = express();

const corsOptions = {
    origin: 'http://localhost:8080',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', chainsRoutes);
app.use('/api', walletRoutes);

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // updateChainsData(process.env.RABBY_ACCESS_KEY)
    //     .then(() => console.log('Initial chain data update complete'))
    //     .catch((err) => console.error('Failed to update chains on startup:', err));
});