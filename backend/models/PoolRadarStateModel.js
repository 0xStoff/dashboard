import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const PoolRadarState = sequelize.define("PoolRadarState", {
    key: { type: DataTypes.STRING(120), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
}, {
    tableName: "pool_radar_state",
    timestamps: false,
});

export default PoolRadarState;
