// src/models/User.js
import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const User = sequelize.define('User', {
    wallet: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    tag: {
        type: DataTypes.STRING,
    },
});

export default User;