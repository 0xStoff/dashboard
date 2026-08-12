import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PortfolioAssetSnapshot = sequelize.define(
  "portfolio_asset_snapshot",
  {
    snapshotId: {
      field: "snapshot_id",
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: { model: "portfolio_snapshots", key: "id" },
      onDelete: "CASCADE",
    },
    assetId: {
      field: "asset_id",
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: { model: "portfolio_assets", key: "id" },
      onDelete: "CASCADE",
    },
    balance: {
      type: DataTypes.DECIMAL(40, 18),
      allowNull: true,
    },
    usdValue: {
      field: "usd_value",
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
  },
  {
    tableName: "portfolio_asset_snapshots",
    timestamps: false,
    indexes: [
      {
        fields: ["asset_id", "snapshot_id"],
        name: "portfolio_asset_snapshots_asset_snapshot_idx",
      },
    ],
  }
);

PortfolioAssetSnapshot.removeAttribute("id");

export default PortfolioAssetSnapshot;
