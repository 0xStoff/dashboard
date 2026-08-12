import { Sequelize } from "sequelize";

const {
  DATABASE_URL,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_HOST = "postgres",
  DB_PORT = "5432",
} = process.env;

const logging = (msg) => {
  if (msg?.startsWith?.("ERROR")) {
    console.error(msg);
  }
};

if (!DATABASE_URL && (!DB_NAME || !DB_USER || !DB_PASSWORD)) {
  throw new Error("Database configuration is required: set DATABASE_URL or DB_NAME, DB_USER, and DB_PASSWORD.");
}

const sequelize = DATABASE_URL
  ? new Sequelize(DATABASE_URL, { dialect: "postgres", logging })
  : new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
      host: DB_HOST,
      port: Number(DB_PORT),
      dialect: "postgres",
      logging,
    });

export default sequelize;
