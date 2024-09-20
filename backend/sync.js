// src/sync.js
const sequelize = require('./sequelize');
const Coin = require('./models/Coin');
const HistoricalPrice = require('./models/HistoricalPrice');
const User = require('./models/User');
const UserCoin = require('./models/UserCoin');

const syncDatabase = async () => {
    await sequelize.sync({ force: true }); // Use { force: true } only for development
    console.log('Database synced!');
};

syncDatabase().catch(console.error);