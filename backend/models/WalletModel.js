import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

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
    },
    show_chip: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
},{
    timestamps: false,
});

export default WalletModel;