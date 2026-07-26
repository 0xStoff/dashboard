import { createHash, randomUUID } from "node:crypto";

import type pg from "pg";

export interface RefreshWalletRecord {
  key: string;
  tag: string;
  kind: string;
  address: string;
}

export interface PortfolioRefreshStatusRecord {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "partial" | "failed" | "cancelled";
  queuedAt: string;
  updatedAt: string;
  errorCode: string | null;
  sources: unknown[];
}

export async function enqueuePortfolioRefresh(pool: pg.Pool, accountId: string): Promise<PortfolioRefreshStatusRecord> {
  return accountTransaction(pool, accountId, async (client) => {
    const active = await latestStatus(client, accountId, true);
    if (active) return active;
    let connection = await client.query<{ id: string }>(`
      select id from portfolio_v2.provider_connections
      where account_id = $1 and provider = 'local-multichain' and status = 'active'
      order by created_at limit 1
    `, [accountId]);
    if (!connection.rows[0]) {
      connection = await client.query<{ id: string }>(`
        insert into portfolio_v2.provider_connections (id, account_id, provider, label)
        values ($1, $2, 'local-multichain', 'Local multi-chain refresh') returning id
      `, [randomUUID(), accountId]);
    }
    const jobId = randomUUID();
    const result = await client.query<{ id: string; status: PortfolioRefreshStatusRecord["status"]; created_at: Date; updated_at: Date }>(`
      insert into portfolio_v2.sync_jobs
        (id, account_id, provider_connection_id, capability, request, priority, max_attempts, idempotency_key)
      values ($1, $2, $3, 'balances', $4::jsonb, 200, 1, $5)
      returning id, status, created_at, updated_at
    `, [jobId, accountId, connection.rows[0]!.id, JSON.stringify({ provider: "local-multichain", scope: "all-chains" }), `portfolio-refresh:${jobId}`]);
    const row = result.rows[0]!;
    return { jobId: row.id, status: row.status, queuedAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), errorCode: null, sources: [] };
  });
}

export async function findPortfolioRefreshStatus(pool: pg.Pool, accountId: string): Promise<PortfolioRefreshStatusRecord | null> {
  return accountTransaction(pool, accountId, (client) => latestStatus(client, accountId, false));
}

export async function loadRefreshWallets(pool: pg.Pool, accountId: string): Promise<RefreshWalletRecord[]> {
  return accountTransaction(pool, accountId, async (client) => {
    const result = await client.query<{ source_key: string; payload: unknown }>(`
      select distinct on (record.source_key) record.source_key, record.payload
      from portfolio_v2.legacy_import_records record
      join portfolio_v2.legacy_import_batches batch on batch.id = record.import_batch_id
      where batch.account_id = $1 and record.source_table = 'wallets'
      order by record.source_key, batch.completed_at desc nulls last, record.imported_at desc
    `, [accountId]);
    return result.rows.flatMap((row) => {
      const payload = object(row.payload);
      const address = stringValue(payload.address) || stringValue(payload.wallet);
      const kind = stringValue(payload.kind) || stringValue(payload.chain);
      if (!address || !kind) return [];
      return [{ key: row.source_key, tag: stringValue(payload.tag) || row.source_key, kind, address }];
    });
  });
}

export async function beginPortfolioRefreshRun(pool: pg.Pool, job: { id: string; accountId: string; connectionId: string }): Promise<string> {
  return accountTransaction(pool, job.accountId, async (client) => {
    const runId = randomUUID();
    await client.query(`insert into portfolio_v2.sync_runs
      (id, account_id, job_id, provider_connection_id, provider, adapter_version, capability, status, started_at)
      values ($1, $2, $3, $4, 'local-multichain', '1', 'balances', 'running', now())`,
    [runId, job.accountId, job.id, job.connectionId]);
    return runId;
  });
}

export async function completePortfolioRefresh(
  pool: pg.Pool,
  input: { jobId: string; accountId: string; connectionId: string; runId: string; result: unknown; snapshot: unknown; totalValue: string; complete: boolean },
): Promise<void> {
  await accountTransaction(pool, input.accountId, async (client) => {
    const payload = JSON.stringify(input.result);
    const hash = createHash("sha256").update(payload).digest("hex");
    await client.query(`insert into portfolio_v2.raw_observations
      (id, account_id, sync_run_id, provider_connection_id, capability, endpoint, request_fingerprint,
       content_sha256, payload, schema_version, received_at, metadata)
      values ($1,$2,$3,$4,'balances','local-multichain:all-chains',$5,$6,$7::jsonb,'portfolio-refresh-v1',now(),$8::jsonb)`,
    [randomUUID(), input.accountId, input.runId, input.connectionId, input.jobId, hash, payload, JSON.stringify({ normalized: true })]);
    if (input.complete) {
      await client.query(`insert into portfolio_v2.portfolio_refresh_snapshots
        (id, account_id, job_id, sync_run_id, as_of, reporting_currency, total_value, snapshot, source_status, completeness)
        values ($1,$2,$3,$4,now(),'USD',$5,$6::jsonb,$7::jsonb,'complete')`,
      [randomUUID(), input.accountId, input.jobId, input.runId, input.totalValue, JSON.stringify(input.snapshot), JSON.stringify(object(input.result).sources ?? [])]);
    }
    const status = input.complete ? "succeeded" : "partial";
    await client.query(`update portfolio_v2.sync_runs set status=$2, completed_at=now(), accepted_observation_count=$3,
      reconciliation_status=$4, warnings=$5::jsonb where id=$1`,
    [input.runId, status, input.complete ? 1 : 0, input.complete ? "promoted" : "previous_snapshot_preserved", JSON.stringify(input.complete ? [] : [{ code: "SOURCE_INCOMPLETE" }])]);
    await client.query(`update portfolio_v2.sync_jobs set status=$2, lease_owner=null, lease_expires_at=null,
      last_error_code=$3, updated_at=now() where id=$1`, [input.jobId, status, input.complete ? null : "SOURCE_INCOMPLETE"]);
  });
}

export async function failPortfolioRefresh(pool: pg.Pool, input: { jobId: string; accountId: string; runId?: string; code: string }): Promise<void> {
  await accountTransaction(pool, input.accountId, async (client) => {
    if (input.runId) await client.query(`update portfolio_v2.sync_runs set status='failed', completed_at=now(), error=$2::jsonb where id=$1`, [input.runId, JSON.stringify({ code: input.code })]);
    await client.query(`update portfolio_v2.sync_jobs set status='failed', lease_owner=null, lease_expires_at=null, last_error_code=$2, updated_at=now() where id=$1`, [input.jobId, input.code]);
  });
}

async function latestStatus(client: pg.PoolClient, accountId: string, activeOnly: boolean): Promise<PortfolioRefreshStatusRecord | null> {
  const result = await client.query<{ id: string; status: PortfolioRefreshStatusRecord["status"]; created_at: Date; updated_at: Date; last_error_code: string | null; sources: unknown }>(`
    select job.id, job.status, job.created_at, job.updated_at, job.last_error_code,
      coalesce(snapshot.source_status, observation.sources, run.warnings, '[]'::jsonb) sources
    from portfolio_v2.sync_jobs job
    join portfolio_v2.provider_connections connection on connection.id=job.provider_connection_id
    left join lateral (select warnings from portfolio_v2.sync_runs where job_id=job.id order by started_at desc limit 1) run on true
    left join lateral (
      select payload->'sources' sources from portfolio_v2.raw_observations
      where request_fingerprint=job.id::text order by received_at desc limit 1
    ) observation on true
    left join portfolio_v2.portfolio_refresh_snapshots snapshot on snapshot.job_id=job.id
    where job.account_id=$1 and connection.provider='local-multichain'
      ${activeOnly ? "and job.status in ('queued','running')" : ""}
    order by job.created_at desc limit 1
  `, [accountId]);
  const row = result.rows[0];
  return row ? { jobId: row.id, status: row.status, queuedAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), errorCode: row.last_error_code, sources: Array.isArray(row.sources) ? row.sources : [] } : null;
}

async function accountTransaction<T>(pool: pg.Pool, accountId: string, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("begin"); await client.query("select set_config('app.account_id',$1,true)",[accountId]); const value=await operation(client); await client.query("commit"); return value; }
  catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
function object(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
