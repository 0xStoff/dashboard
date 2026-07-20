import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const CapitalFlowModel = sequelize.define(
  "capital_flows",
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scope_chain_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("deposit", "withdrawal"),
      allowNull: false,
    },
    asset: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(36, 18),
      allowNull: false,
    },
    usd_value: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tx_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    indexes: [
      { fields: ["user_id", "scope_chain_id", "occurred_at"] },
      { unique: true, fields: ["user_id", "scope_chain_id", "tx_hash"] },
    ],
  }
);

export default CapitalFlowModel;
