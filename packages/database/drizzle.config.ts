import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for migrations");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL },
  migrations: { schema: "portfolio_v2_migrations" },
  strict: true,
  verbose: true,
});
