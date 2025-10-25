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
  },
  {
    timestamps: false,
  }
);


export default ProtocolModel;