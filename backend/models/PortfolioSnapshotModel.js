import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PortfolioSnapshot = sequelize.define(
  "portfolio_snapshot",
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
    capturedAt: {
      field: "captured_at",
      type: DataTypes.DATE,
      allowNull: false,
    },
    snapshotDate: {
      field: "snapshot_date",
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    totalUsd: {
      field: "total_usd",
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    tokenUsd: {
      field: "token_usd",
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    protocolUsd: {
      field: "protocol_usd",
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "portfolio_snapshots",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "snapshot_date"],
        name: "portfolio_snapshots_user_date_unique",
      },
      {
        fields: ["user_id", "captured_at"],
        name: "portfolio_snapshots_user_captured_at_idx",
      },
    ],
  }
);

export default PortfolioSnapshot;
