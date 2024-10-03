import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import WalletModel from './WalletModel.js';
import WalletTokenModel from './WalletTokenModel.js';

const TokenModel = sequelize.define('tokens', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    chain_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    },
    decimals: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    price: {
        type: DataTypes.DECIMAL(20, 8)
    },
    logo_path: {
        type: DataTypes.STRING
    }
}, {
    timestamps: false,
});

export default TokenModel;