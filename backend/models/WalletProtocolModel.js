import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const WalletProtocolModel = sequelize.define('wallets_protocols', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wallet_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'wallets', // References the 'wallets' table
      key: 'id'
    }
  },
  protocol_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'protocols', // References the 'protocols' table
      key: 'id'
    }
  },
  portfolio_item_list: {
    type: DataTypes.JSON, // JSON type to store a list of items
    allowNull: true,
  },
}, {
  tableName: 'wallets_protocols',
  timestamps: false
});

export default WalletProtocolModel;