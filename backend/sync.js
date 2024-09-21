// src/sync.js
import sequelize from './sequelize.js';
import Coin from './models/Coin.js';
import HistoricalPrice from './models/HistoricalPrice.js';
import User from './models/User.js';
import UserCoin from './models/UserCoin.js';

const syncDatabase = async () => {
    await sequelize.sync({ force: true }); // Use { force: true } only for development
    console.log('Database synced!');
};

syncDatabase().catch(console.error);