// src/models/EvmChain.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const EvmChain = sequelize.define('evm_chains', {
    chain_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    native_token_id: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    wrapped_token_id: {
        type: DataTypes.STRING,
    },
    logo_path: {
        type: DataTypes.STRING,
    },
}, {
    timestamps: false,
});

export default EvmChain;