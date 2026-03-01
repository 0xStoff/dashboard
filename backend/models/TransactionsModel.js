import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const TransactionModel = sequelize.define("transactions", {
  orderNo: {
    type: DataTypes.STRING,
    primaryKey: true, // ✅ Make orderNo the primary key
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  fee: {
    type: DataTypes.DECIMAL(20, 8),
    allowNull: true
  },
  asset: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  merchant: {
    type: DataTypes.STRING,
    allowNull: true
  },
  transactionAmount: {
    type: DataTypes.STRING,
    allowNull: true
  },
  billingAmount: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ["orderNo"]
    }
  ]

});

export default TransactionModel;