import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.join(__dirname, "migrations");
const lockName = "dashboard-schema-migrations-v1";

const databaseConfig = () => {
    if (process.env.DATABASE_URL) {
        return { connectionString: process.env.DATABASE_URL };
    }

    return {
        host: process.env.DB_HOST || "postgres",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || "crypto_dashboard",
        user: process.env.DB_USER || "stoff",
        password: process.env.DB_PASSWORD,
    };
};

const migrationFiles = async () => (await fs.readdir(migrationsDirectory))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort();

const sha256 = (content) => crypto.createHash("sha256").update(content).digest("hex");

const ensureJournal = (client) => client.query(`
    CREATE TABLE IF NOT EXISTS dashboard_schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
`);

export const runMigrations = async ({ dryRun = false } = {}) => {
    const pool = new Pool(databaseConfig());
    const client = await pool.connect();

    try {
        await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
        await ensureJournal(client);

        const appliedResult = await client.query(
            "SELECT version, checksum, applied_at FROM dashboard_schema_migrations ORDER BY version"
        );
        const applied = new Map(appliedResult.rows.map((row) => [row.version, row]));
        const pending = [];

        for (const version of await migrationFiles()) {
            const sql = await fs.readFile(path.join(migrationsDirectory, version), "utf8");
            const checksum = sha256(sql);
            const previous = applied.get(version);

            if (previous && previous.checksum !== checksum) {
                throw new Error(`Applied migration ${version} has been modified`);
            }
            if (previous) continue;

            pending.push(version);
            if (dryRun) continue;

            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query(
                    "INSERT INTO dashboard_schema_migrations(version, checksum) VALUES ($1, $2)",
                    [version, checksum]
                );
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }

        return {
            applied: applied.size,
            pending,
            mode: dryRun ? "status" : "migrate",
        };
    } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => undefined);
        client.release();
        await pool.end();
    }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const dryRun = process.argv.includes("--status");
    runMigrations({ dryRun })
        .then((result) => {
            console.log(JSON.stringify(result, null, 2));
        })
        .catch((error) => {
            console.error(`Database migration failed: ${error.message}`);
            process.exitCode = 1;
        });
}
