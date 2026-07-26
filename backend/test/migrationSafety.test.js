import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../db/migrations/001_portfolio_core.sql", import.meta.url);
const serverPath = new URL("../server.js", import.meta.url);

test("the portfolio-core migration is additive and contains provenance tables", async () => {
    const sql = await fs.readFile(migrationPath, "utf8");
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE)\b/i);
    assert.match(sql, /CREATE TABLE portfolio_core\.sync_runs/i);
    assert.match(sql, /CREATE TABLE portfolio_core\.raw_observations/i);
    assert.match(sql, /CREATE TABLE portfolio_core\.asset_identities/i);
    assert.match(sql, /raw_observations_append_only/i);
});

test("normal server startup does not synchronize the legacy schema", async () => {
    const server = await fs.readFile(serverPath, "utf8");
    assert.match(server, /ALLOW_LEGACY_SCHEMA_SYNC/);
    assert.match(server, /sequelize\.authenticate\(\)/);
});
