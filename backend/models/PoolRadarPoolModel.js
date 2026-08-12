import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PoolRadarPool = sequelize.define("PoolRadarPool", {
    id: { type: DataTypes.STRING(66), primaryKey: true },
    version: { type: DataTypes.STRING(2), allowNull: false },
    address: { type: DataTypes.STRING(42), allowNull: true },
    token0: { type: DataTypes.STRING(42), allowNull: false },
    token1: { type: DataTypes.STRING(42), allowNull: false },
    feePips: { type: DataTypes.INTEGER, allowNull: true, field: "fee_pips" },
    tickSpacing: { type: DataTypes.INTEGER, allowNull: true, field: "tick_spacing" },
    hook: { type: DataTypes.STRING(42), allowNull: true },
    createdBlock: { type: DataTypes.BIGINT, allowNull: false, field: "created_block" },
    metrics: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
    tableName: "pool_radar_pools",
    underscored: true,
});

export default PoolRadarPool;
