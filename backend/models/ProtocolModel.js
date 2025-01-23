// models/ProtocolModel.js
import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";
import WalletModel from "./WalletModel.js"; // Import WalletModel

const ProtocolModel = sequelize.define(
  "protocols",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    chain_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    logo_path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    total_usd: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
    },
    portfolio_item_list: {
      type: DataTypes.JSON, // JSON type to store a list of items
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);


export default ProtocolModel;