// src/models/HistoricalPrice.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import Coin from './Coin.js';

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

export default HistoricalPrice;