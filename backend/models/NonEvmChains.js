// src/models/NonEvmChain.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const NonEvmChain = sequelize.define('non_evm_chains', {
    chain_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    endpoint: {
        type: DataTypes.STRING,
    },
    logo_path: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: false,
});

export default NonEvmChain;