import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import TokenModel from './TokenModel.js';
import WalletTokenModel from './WalletTokenModel.js';

const WalletModel = sequelize.define('wallets', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    wallet: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    tag: {
        type: DataTypes.STRING
    },
    chain: {
        type: DataTypes.STRING,
        allowNull: false
    }
},{
    timestamps: false,
});

export default WalletModel;