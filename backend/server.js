import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nonEvmRoutes from "./api/chains.js";
import walletRoutes from "./api/wallets.js";
import chainsRoutes from "./api/chains.js";
import tokensRoutes from "./api/tokens.js";
import sequelize from "./sequelize.js";
import WalletModel from "./models/WalletModel.js";
import TokenModel from "./models/TokenModel.js";
import WalletTokenModel from "./models/WalletTokenModel.js";
import transactionsRoutes from './api/transactions.js';
import path from "path";
import { fileURLToPath } from 'url';
import { fetchAndSaveEvmTokenDataForAllWallets } from "./token_data/evm_token_data.js";
import { fetchCosmosTokens } from "./token_data/cosmos_token_data.js";
import { writeAptosDataToDB, writeStaticDataToDB, writeSuiDataToDB } from "./token_data/sui_data.js";
import { updateChainsData, updateNonEvmChainsData } from "./utils/chain_data.js";
import { evmChains, nonEvmChains } from "./utils/chainlist.js";
import { fetchAndSaveSolTokenDataForAllWallets } from "./token_data/sol_token_data.js";

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
app.use('/api', transactionsRoutes);
app.use('/logos', express.static(path.join(__dirname, 'logos')));
// Set up associations after all models are defined
const setupAssociations = () => {
    WalletModel.belongsToMany(TokenModel, {through: WalletTokenModel, foreignKey: 'wallet_id'});
    TokenModel.belongsToMany(WalletModel, {through: WalletTokenModel, foreignKey: 'token_id'});
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


        // writeSuiDataToDB()
        //     .then(() => console.log('Token Data for sui wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch sui Tokens:', err));
        //
        //
        // updateNonEvmChainsData(nonEvmChains)
        //     .then(() => console.log('Non-EVM chains updated'))
        //     .catch((error) => console.error('Error updating non-EVM chains:', error));
        //
        //
        // updateChainsData(await evmChains())
        //     .then(() => console.log('Initial chain data update complete'))
        //     .catch((err) => console.error('Failed to update chains on startup:', err));
        //
        // fetchAndSaveSolTokenDataForAllWallets()
        //     .then(() => console.log('Token Data for sol Wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch Tokens:', err));
        //
        //
        // fetchAndSaveEvmTokenDataForAllWallets()
        //     .then(() => console.log('Token Data for all Wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch Tokens:', err));
        //
        //
        // const test = await fetchCosmosTokens()
        // console.log(test)

        // fetchAndSaveCosmosTokenData()
        //     .then(() => console.log('Token Data for cosmos wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch cosmos Tokens:', err));


    });
}).catch(error => {
    console.error('Failed to sync database:', error);
});

