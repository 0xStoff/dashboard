// src/sync.js
import sequelize from './sequelize.js';

const syncDatabase = async () => {
    await sequelize.sync();
    console.log('Database synced!');
};

syncDatabase().catch(console.error);