// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nonEvmRoutes from "./api/non_evm_chains.js";
import walletRoutes from "./api/wallets.js";
import chainsRoutes from "./api/evm_chains.js";


dotenv.config();

const app = express();

const corsOptions = {
    origin: 'http://localhost:8080', methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', chainsRoutes);
app.use('/api', walletRoutes);
app.use('/api', nonEvmRoutes);

const port = 3000;
app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    // updateNonEvmChainsData(nonEvmChains)
    //     .then(() => console.log('Non-EVM chains updated'))
    //     .catch((error) => console.error('Error updating non-EVM chains:', error));
    //
    //
    // updateChainsData(await evmChains())
    //     .then(() => console.log('Initial chain data update complete'))
    //     .catch((err) => console.error('Failed to update chains on startup:', err));
});