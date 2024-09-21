// src/models/UserCoin.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import User from './User.js';
import Coin from './Coin.js';

const UserCoin = sequelize.define('UserCoin', {
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
});

// Define relationships
UserCoin.belongsTo(User);
UserCoin.belongsTo(Coin);

export default UserCoin;