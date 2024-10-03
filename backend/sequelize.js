// src/sequelize.js
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('crypto_dashboard', 'stoff', 'abc123', {
    host: 'localhost',
    dialect: 'postgres',
    logging: (msg) => {
        if (msg.startsWith('ERROR') || msg.includes('Token data successfully saved/updated')) {
            console.log(msg);
        }
    },
});

export default sequelize;