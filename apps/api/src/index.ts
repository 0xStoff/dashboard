import { loadRuntimeConfig } from "@dashboard/config";
import { createDatabase } from "@dashboard/database";

import { buildApp } from "./app.js";

const config = loadRuntimeConfig("api");
const { pool } = createDatabase(config.database);
const localSnapshotAccountId = process.env.LOCAL_SNAPSHOT_ACCOUNT_ID?.trim() || null;
if (localSnapshotAccountId && config.environment === "production") {
  throw new Error("LOCAL_SNAPSHOT_ACCOUNT_ID is forbidden in production");
}
if (localSnapshotAccountId && config.host !== "127.0.0.1" && config.host !== "localhost") {
  throw new Error("LOCAL_SNAPSHOT_ACCOUNT_ID requires a loopback-only API host");
}
const app = buildApp(pool, localSnapshotAccountId);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await pool.end();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: config.host, port: config.port });
