import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { DatabaseConfig } from "@dashboard/config";

import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDatabase>["db"];
export type DatabasePool = pg.Pool;

export function createDatabase(config: DatabaseConfig) {
  const pool = new pg.Pool({
    connectionString: config.url,
    max: config.poolMax,
    statement_timeout: config.statementTimeoutMs,
    application_name: "portfolio-dashboard-v2",
  });
  return { pool, db: drizzle(pool, { schema }) };
}
