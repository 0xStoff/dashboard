import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nonEvmRoutes from "./api/chains.js";
import walletRoutes from "./api/wallets.js";
import chainsRoutes from "./api/chains.js";
import protocolsRoutes from "./api/protocols.js";
import tokensRoutes from "./api/tokens.js";
import sequelize from "./sequelize.js";
import WalletModel from "./models/WalletModel.js";
import TokenModel from "./models/TokenModel.js";
import WalletTokenModel from "./models/WalletTokenModel.js";
import transactionsRoutes from './api/transactions.js';
import path from "path";
import { fileURLToPath } from 'url';
import { fetchAndSaveEvmTokenData, fetchAndSaveEvmTokenDataForAllWallets } from "./token_data/evm_token_data.js";
import { fetchCosmosTokens } from "./token_data/cosmos_token_data.js";
import { writeAptosDataToDB, writeStaticDataToDB, writeSuiDataToDB } from "./token_data/sui_data.js";
import { fetchAndSaveSolTokenDataForAllWallets } from "./token_data/sol_token_data.js";
import ProtocolModel from "./models/ProtocolModel.js";
import WalletProtocolModel from "./models/WalletProtocolModel.js";

dotenv.config();

const app = express();
const port = 3000;

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
    origin: 'http://localhost:8080', methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
console.log(path.join(__dirname, '/backend/logos'))

app.use('/api', chainsRoutes);
app.use('/api', walletRoutes);
app.use('/api', nonEvmRoutes);
app.use('/api', tokensRoutes);
app.use('/api', protocolsRoutes);
app.use('/api', transactionsRoutes);
app.use('/logos', express.static(path.join(__dirname, 'logos')));

const runAllTokenDataFunctions = async () => {
    try {
        await sequelize.query("DELETE FROM wallets_tokens;");
        console.log("Cleared table: wallets_tokens");

        await sequelize.query("DELETE FROM tokens;");
        console.log("Cleared table: tokens");

        await sequelize.query("DELETE FROM wallets_protocols;");
        console.log("Cleared table: wallets_protocols");

        await sequelize.query("DELETE FROM protocols;");
        console.log("Cleared table: protocols");


        // Recreate tables and execute token data functions
        const promises = [
            writeStaticDataToDB(),
            writeAptosDataToDB(),
            writeSuiDataToDB(),
            fetchAndSaveSolTokenDataForAllWallets(),
            fetchAndSaveEvmTokenDataForAllWallets(),
            fetchCosmosTokens()
        ];

        await Promise.all(promises);
        console.log('All token data functions executed successfully.');
        return { status: 'success', message: 'All token data functions executed successfully.' };
    } catch (error) {
        console.error('Error executing token data functions:', error);
        return { status: 'error', message: 'Error executing token data functions.', error };
    }
};


// Expose an API endpoint for the frontend to call this function
app.post('/api/runAllTokenDataFunctions', async (req, res) => {
    const result = await runAllTokenDataFunctions();
    res.json(result);
});

// Set up associations after all models are defined
const setupAssociations = () => {
    WalletModel.belongsToMany(TokenModel, {through: WalletTokenModel, foreignKey: 'wallet_id'});
    TokenModel.belongsToMany(WalletModel, {through: WalletTokenModel, foreignKey: 'token_id'});
    WalletModel.belongsToMany(ProtocolModel, {through: WalletProtocolModel, foreignKey: 'wallet_id'});
    ProtocolModel.belongsToMany(WalletModel, {through: WalletProtocolModel, foreignKey: 'protocol_id'});
};

const initDb = async () => {
    setupAssociations();
    await sequelize.sync();
};

initDb().then(() => {
    console.log('Database synced');
    app.listen(port, async () => {
        console.log('Server running on port 3000');


        // writeStaticDataToDB()
        //     .then(() => console.log('Token Data for static wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch static Tokens:', err));

        // writeAptosDataToDB()
        //     .then(() => console.log('Token Data for aptos wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch aptos Tokens:', err));
        //
        //
        // writeSuiDataToDB()
        //     .then(() => console.log('Token Data for sui wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch sui Tokens:', err));
        //
        // fetchAndSaveSolTokenDataForAllWallets()
        //     .then(() => console.log('Token Data for sol Wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch Tokens:', err));


        // fetchAndSaveEvmTokenDataForAllWallets()
        //      .then(() => console.log('Token Data for all Wallets fetched'))
        //      .catch((err) => console.error('Failed to fetch Tokens:', err));

        //
        //

        // fetchAndSaveEvmTokenData(6, "0xa8d58cd36835970af11be0ff1f9e2d66c79417cb")
        //      .then(() => console.log('Token Data for l 1.25 fetched'))

        // fetchCosmosTokens()
        //      .then(() => console.log('Token Data for cosmos Wallets fetched'))
        //      .catch((err) => console.error('Failed to fetch cosmos Tokens:', err));


        //
        // updateNonEvmChainsData(nonEvmChains)
        //     .then(() => console.log('Non-EVM chains updated'))
        //     .catch((error) => console.error('Error updating non-EVM chains:', error));
        //
        //
        // updateChainsData(await evmChains())
        //     .then(() => console.log('Initial chain data update complete'))
        //     .catch((err) => console.error('Failed to update chains on startup:', err));


    });
}).catch(error => {
    console.error('Failed to sync database:', error);
});

