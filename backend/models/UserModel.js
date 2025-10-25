import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';


const UserModel = sequelize.define('users', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    main_wallet: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    nonce: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: false
});

export default UserModel;