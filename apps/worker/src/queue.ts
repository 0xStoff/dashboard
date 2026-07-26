import type { DatabasePool } from "@dashboard/database";

export interface LeasedJob {
  id: string;
  accountId: string;
  connectionId: string;
  walletId: string | null;
  chainId: string | null;
  capability: "balances" | "transactions" | "prices";
  request: unknown;
  attempts: number;
}

export async function leaseNextJob(pool: DatabasePool, workerId: string, leaseSeconds: number): Promise<LeasedJob | null> {
  const accounts = await pool.query<{ id: string }>(
    "select id from portfolio_v2.accounts where status = 'active' order by id",
  );
  for (const account of accounts.rows) {
    const job = await leaseForAccount(pool, account.id, workerId, leaseSeconds);
    if (job) return job;
  }
  return null;
}

async function leaseForAccount(
  pool: DatabasePool,
  accountId: string,
  workerId: string,
  leaseSeconds: number,
): Promise<LeasedJob | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.account_id', $1, true)", [accountId]);
    const result = await client.query<{
      id: string;
      account_id: string;
      provider_connection_id: string;
      wallet_id: string | null;
      chain_id: string | null;
      capability: LeasedJob["capability"];
      request: unknown;
      attempts: number;
    }>(`
      with candidate as (
        select id
        from portfolio_v2.sync_jobs
        where account_id = $3
          and status = 'queued'
          and scheduled_at <= now()
          and cancelled_at is null
          and attempts < max_attempts
        order by priority desc, scheduled_at, created_at
        for update skip locked
        limit 1
      )
      update portfolio_v2.sync_jobs as job
      set status = 'running',
          lease_owner = $1,
          lease_expires_at = now() + make_interval(secs => $2),
          attempts = attempts + 1,
          updated_at = now()
      from candidate
      where job.id = candidate.id
      returning job.id, job.account_id, job.provider_connection_id, job.wallet_id,
                job.chain_id, job.capability, job.request, job.attempts
    `, [workerId, leaseSeconds, accountId]);
    await client.query("commit");
    const row = result.rows[0];
    return row ? {
      id: row.id,
      accountId: row.account_id,
      connectionId: row.provider_connection_id,
      walletId: row.wallet_id,
      chainId: row.chain_id,
      capability: row.capability,
      request: row.request,
      attempts: row.attempts,
    } : null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseUnconfiguredJob(pool: DatabasePool, job: LeasedJob, message: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.account_id', $1, true)", [job.accountId]);
    await client.query(`
      update portfolio_v2.sync_jobs
      set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
          scheduled_at = now() + interval '5 minutes',
          lease_owner = null,
          lease_expires_at = null,
          last_error_code = 'PROVIDER_NOT_CONFIGURED',
          updated_at = now()
      where id = $1 and status = 'running'
    `, [job.id]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  void message;
}
