// src/sequelize.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('crypto_dashboard', 'your_username', 'your_password', {
    host: 'localhost',
    dialect: 'postgres',
});

module.exports = sequelize;