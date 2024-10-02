import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nonEvmRoutes from "./api/non_evm_chains.js";
import walletRoutes from "./api/wallets.js";
import chainsRoutes from "./api/evm_chains.js";
import tokensRoutes from "./api/tokens.js";
import sequelize from "./sequelize.js";
import Wallet from "./models/Wallet.js";
import Token from "./models/Token.js";
import WalletToken from "./models/WalletToken.js";
import {fetchAndSaveSolTokenDataForAllWallets} from "./utils/token_data.js";

dotenv.config();

const app = express();
const port = 3000;

const corsOptions = {
    origin: 'http://localhost:8080', methods: ['GET', 'POST', 'PUT', 'DELETE'], credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', chainsRoutes);
app.use('/api', walletRoutes);
app.use('/api', nonEvmRoutes);
app.use('/api', tokensRoutes);

// Set up associations after all models are defined
const setupAssociations = () => {
    Wallet.belongsToMany(Token, { through: WalletToken, foreignKey: 'wallet_id' });
    Token.belongsToMany(Wallet, { through: WalletToken, foreignKey: 'token_id' });
};

const initDb = async () => {
    setupAssociations(); // Set up associations only after both models are initialized
    await sequelize.sync();
};

initDb().then(() => {
    console.log('Database synced');
    app.listen(port, async () => {
        console.log('Server running on port 3000');

        // const test = await fetchAndSaveSolTokenDataForAllWallets();
        // console.log(test)
    });
}).catch(error => {
    console.error('Failed to sync database:', error);
});


        // updateNonEvmChainsData(nonEvmChains)
        //     .then(() => console.log('Non-EVM chains updated'))
        //     .catch((error) => console.error('Error updating non-EVM chains:', error));
        //
        //
        // updateChainsData(await evmChains())
        //     .then(() => console.log('Initial chain data update complete'))
        //     .catch((err) => console.error('Failed to update chains on startup:', err));
        //
        //
        // fetchAndSaveEvmTokenDataForAllWallets()
        //     .then(() => console.log('Token Data for all Wallets fetched'))
        //     .catch((err) => console.error('Failed to fetch Tokens:', err));
