import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PoolRadarSwap = sequelize.define("PoolRadarSwap", {
    id: { type: DataTypes.STRING(90), primaryKey: true },
    poolId: { type: DataTypes.STRING(66), allowNull: false, field: "pool_id" },
    blockNumber: { type: DataTypes.BIGINT, allowNull: false, field: "block_number" },
    transactionHash: { type: DataTypes.STRING(66), allowNull: false, field: "transaction_hash" },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    volumeUsd: { type: DataTypes.DECIMAL(30, 8), allowNull: false, field: "volume_usd" },
    lpFeeUsd: { type: DataTypes.DECIMAL(30, 8), allowNull: false, field: "lp_fee_usd" },
    feePips: { type: DataTypes.INTEGER, allowNull: false, field: "fee_pips" },
}, {
    tableName: "pool_radar_swaps",
    timestamps: false,
    indexes: [
        { fields: ["pool_id", "timestamp"] },
        { fields: ["block_number"] },
    ],
});

export default PoolRadarSwap;
