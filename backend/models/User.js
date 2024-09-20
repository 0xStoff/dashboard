// src/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const User = sequelize.define('User', {
    wallet: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    tag: {
        type: DataTypes.STRING,
    },
});

module.exports = User;