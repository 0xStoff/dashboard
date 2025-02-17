import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const SettingsModel = sequelize.define("settings", {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.FLOAT, // or INTEGER depending on how you want to store it
    allowNull: false,
  },
}, {
  timestamps: false
});

export default SettingsModel;