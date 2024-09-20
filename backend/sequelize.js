// src/sequelize.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('crypto_dashboard', 'stoff', '', {
    host: 'localhost',
    dialect: 'postgres',
});

module.exports = sequelize;