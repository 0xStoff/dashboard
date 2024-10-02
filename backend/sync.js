// src/sync.js
import sequelize from './sequelize.js';

const syncDatabase = async () => {
    await sequelize.sync({ force: true }); // Use { force: true } only for development
    console.log('Database synced!');
};

syncDatabase().catch(console.error);