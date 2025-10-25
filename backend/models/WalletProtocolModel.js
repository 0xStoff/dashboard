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
  protocol_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'protocols',
      key: 'id'
    }
  },
  portfolio_item_list: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'wallets_protocols',
  timestamps: false
});


export default WalletProtocolModel;