import { DataTypes } from "sequelize";
import sequelize from "../sequelize.js";

const RobinhoodTransactionClassification = sequelize.define("RobinhoodTransactionClassification", {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    transaction_hash: { type: DataTypes.STRING(66), allowNull: false },
    classification: { type: DataTypes.STRING(32), allowNull: false },
    lifecycle_key: { type: DataTypes.STRING(160), allowNull: true },
    label: { type: DataTypes.STRING(160), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
    tableName: "robinhood_transaction_classifications",
    indexes: [{ unique: true, fields: ["user_id", "transaction_hash"] }],
});

export default RobinhoodTransactionClassification;
