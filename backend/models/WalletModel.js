import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const WalletModel = sequelize.define('wallets', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
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
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    timestamps: false,
});

export default WalletModel;