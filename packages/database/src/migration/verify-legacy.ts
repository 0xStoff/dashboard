import { createHash } from "node:crypto";

import pg from "pg";

const SOURCE_TABLES = [
  "evm_chains",
  "net-worths",
  "non_evm_chains",
  "protocols",
  "settings",
  "tokens",
  "transactions",
  "users",
  "wallets",
  "wallets_protocols",
  "wallets_tokens",
] as const;

const sourcePool = new pg.Pool({ connectionString: required("LEGACY_DATABASE_URL"), max: 2 });
const targetPool = new pg.Pool({ connectionString: required("DATABASE_URL"), max: 2 });
const importBatchId = required("LEGACY_IMPORT_BATCH_ID");

try {
  const batch = await targetPool.query<{
    status: string;
    source_record_count: number;
    imported_record_count: number;
    quarantined_record_count: number;
  }>(`
    select status, source_record_count, imported_record_count, quarantined_record_count
    from portfolio_v2.legacy_import_batches
    where id = $1
  `, [importBatchId]);
  if (batch.rows[0]?.status !== "succeeded") throw new Error("legacy import batch is missing or incomplete");

  const tableResults: Record<string, { source: number; target: number; missing: number; mismatched: number; extra: number }> = {};
  let failures = 0;
  for (const table of SOURCE_TABLES) {
    const source = await sourcePool.query<{ source_key: string; payload_text: string }>(`
      select id::text as source_key, row_to_json(source_row)::text as payload_text
      from public.${quoteIdentifier(table)} as source_row
      order by id
    `);
    const target = await targetPool.query<{ source_key: string; content_sha256: string }>(`
      select source_key, content_sha256
      from portfolio_v2.legacy_import_records
      where import_batch_id = $1 and source_table = $2
    `, [importBatchId, table]);
    const expected = new Map(source.rows.map((row) => [row.source_key, sha256(row.payload_text)]));
    const actual = new Map(target.rows.map((row) => [row.source_key, row.content_sha256]));
    let missing = 0;
    let mismatched = 0;
    let extra = 0;
    for (const [key, hash] of expected) {
      if (!actual.has(key)) missing += 1;
      else if (actual.get(key) !== hash) mismatched += 1;
    }
    for (const key of actual.keys()) if (!expected.has(key)) extra += 1;
    failures += missing + mismatched + extra;
    tableResults[table] = { source: expected.size, target: actual.size, missing, mismatched, extra };
  }

  const normalized = await targetPool.query<{ entity: string; count: string }>(`
    select 'wallets' as entity, count(*)::text from portfolio_v2.wallets where account_id = (
      select account_id from portfolio_v2.legacy_import_batches where id = $1
    )
    union all select 'balance_candidates', count(*)::text from portfolio_v2.legacy_balance_candidates where import_batch_id = $1
    union all select 'protocol_candidates', count(*)::text from portfolio_v2.legacy_protocol_candidates where import_batch_id = $1
    union all select 'transaction_candidates', count(*)::text from portfolio_v2.legacy_transaction_candidates where import_batch_id = $1
    union all select 'unverified_snapshots', count(*)::text from portfolio_v2.legacy_unverified_snapshots where import_batch_id = $1
    union all select 'quarantine_entries', count(*)::text from portfolio_v2.legacy_mapping_quarantine where import_batch_id = $1
  `, [importBatchId]);
  const report = {
    status: failures === 0 ? "verified" : "failed",
    importBatchId,
    sourceRecordCount: batch.rows[0].source_record_count,
    importedRecordCount: batch.rows[0].imported_record_count,
    quarantinedRecordCount: batch.rows[0].quarantined_record_count,
    tableResults,
    normalizedCounts: Object.fromEntries(normalized.rows.map((row) => [row.entity, Number(row.count)])),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failures > 0) throw new Error(`${failures} legacy record verification failures`);
} finally {
  await Promise.all([sourcePool.end(), targetPool.end()]);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z0-9_-]+$/.test(value)) throw new Error("unsafe SQL identifier");
  return `"${value.replaceAll('"', '""')}"`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
