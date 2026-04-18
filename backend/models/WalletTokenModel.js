import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const WalletTokenModel = sequelize.define('wallets_tokens', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    wallet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'wallets',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    token_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tokens',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
    raw_amount: {
        type: DataTypes.DECIMAL(40, 0),
        allowNull: false
    },
    usd_value: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false
    },
}, {
    tableName: 'wallets_tokens',
    timestamps: false
});


export default WalletTokenModel;