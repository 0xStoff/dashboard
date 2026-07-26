import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../migrations/0001_portfolio_v2_foundation.sql", import.meta.url);

test("foundation migration remains additive and tenant isolated", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS portfolio_v2/i);
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|SCHEMA|DATABASE)/i);
  assert.doesNotMatch(sql, /ALTER\s+TABLE\s+(?!portfolio_v2\.)/i);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/g);
  assert.match(sql, /CREATE POLICY account_isolation/g);
});

test("financial evidence tables are append-only", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of ["raw_observations", "portfolio_snapshots", "audit_log"]) {
    assert.match(sql, new RegExp(`CREATE TRIGGER ${table}_append_only`, "i"));
  }
});

test("legacy import migration is additive and keeps uncertain data quarantined", async () => {
  const sql = await readFile(new URL("../migrations/0002_legacy_import_evidence.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|SCHEMA|DATABASE)/i);
  for (const table of [
    "legacy_import_batches",
    "legacy_import_records",
    "legacy_mapping_quarantine",
    "legacy_balance_candidates",
    "legacy_protocol_candidates",
    "legacy_transaction_candidates",
    "legacy_unverified_snapshots",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE portfolio_v2\\.${table}`, "i"));
  }
  assert.match(sql, /legacy_import_records_append_only/i);
  assert.match(sql, /legacy_unverified_snapshots_append_only/i);
});
