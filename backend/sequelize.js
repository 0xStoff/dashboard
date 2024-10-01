// src/sequelize.js
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('crypto_dashboard', 'stoff', 'abc123', {
    host: 'localhost',
    dialect: 'postgres',
});

export default sequelize;