// src/models/Coin.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const Coin = sequelize.define('Coin', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    logo_url: {
        type: DataTypes.STRING,
    },
    current_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

export default Coin;