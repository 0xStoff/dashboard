import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PortfolioAsset = sequelize.define(
  "portfolio_asset",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      field: "user_id",
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    assetType: {
      field: "asset_type",
      type: DataTypes.STRING(16),
      allowNull: false,
      validate: { isIn: [["token", "protocol"]] },
    },
    assetKey: {
      field: "asset_key",
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    chainId: {
      field: "chain_id",
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contractAddress: {
      field: "contract_address",
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "portfolio_assets",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "asset_type", "asset_key"],
        name: "portfolio_assets_user_type_key_unique",
      },
      {
        fields: ["user_id", "asset_type", "chain_id", "symbol"],
        name: "portfolio_assets_token_lookup_idx",
      },
      {
        fields: ["user_id", "asset_type", "chain_id", "contract_address"],
        name: "portfolio_assets_token_contract_lookup_idx",
      },
      {
        fields: ["user_id", "asset_type", "name"],
        name: "portfolio_assets_protocol_lookup_idx",
      },
    ],
  }
);

export default PortfolioAsset;
