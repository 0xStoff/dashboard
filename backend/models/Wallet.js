import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';
import Token from './Token.js';
import WalletToken from './WalletToken.js';

const Wallet = sequelize.define('wallets', {
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

export default Wallet;