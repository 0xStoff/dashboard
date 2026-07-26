import type pg from "pg";

export interface SessionPrincipal {
  sessionId: string;
  userId: string;
  accountId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  reportingCurrency: string;
}

export async function authenticateSession(pool: pg.Pool, tokenHash: string): Promise<SessionPrincipal | null> {
  const result = await pool.query<{
    session_id: string;
    user_id: string;
    account_id: string;
    role: SessionPrincipal["role"];
    reporting_currency: string;
  }>("select * from portfolio_v2.authenticate_session($1)", [tokenHash]);
  const row = result.rows[0];
  return row ? {
    sessionId: row.session_id,
    userId: row.user_id,
    accountId: row.account_id,
    role: row.role,
    reportingCurrency: row.reporting_currency,
  } : null;
}

export async function localSnapshotPrincipal(pool: pg.Pool, accountId: string): Promise<SessionPrincipal | null> {
  const result = await pool.query<{ id: string; reporting_currency: string }>(`
    select id, reporting_currency from portfolio_v2.accounts
    where id = $1 and status = 'active'
  `, [accountId]);
  const row = result.rows[0];
  return row ? {
    sessionId: row.id,
    userId: row.id,
    accountId: row.id,
    role: "owner",
    reportingCurrency: row.reporting_currency,
  } : null;
}
