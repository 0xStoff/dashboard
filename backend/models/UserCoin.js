// src/models/UserCoin.js
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const User = require('./User');
const Coin = require('./Coin');

const UserCoin = sequelize.define('UserCoin', {
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

// Define relationships
UserCoin.belongsTo(User);
UserCoin.belongsTo(Coin);

module.exports = UserCoin;