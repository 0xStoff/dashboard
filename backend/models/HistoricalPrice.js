// src/models/HistoricalPrice.js
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const Coin = require('./Coin');

const HistoricalPrice = sequelize.define('HistoricalPrice', {
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

// Define relationship
HistoricalPrice.belongsTo(Coin);

module.exports = HistoricalPrice;