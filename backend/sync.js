// src/sync.js
import sequelize from './sequelize.js';
import { setupAssociations } from './models/associations.js';
import { runMigrations } from './db/migrate.js';

const syncDatabase = async () => {
    setupAssociations();
    await sequelize.sync();
    await runMigrations();
    console.log('Database synced!');
};

syncDatabase().catch(console.error);
