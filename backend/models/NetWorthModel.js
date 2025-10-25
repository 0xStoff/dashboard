// /models/NetWorthModel.js
import { DataTypes } from "sequelize";
import sequelize from '../sequelize.js';

const NetWorth = sequelize.define("net-worth", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  totalNetWorth: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: false,
  },
  history: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: false,
});

export default NetWorth;