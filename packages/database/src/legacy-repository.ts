import type pg from "pg";

import type {
  LegacyActivityRow,
  LegacyAssetRow,
  LegacyMigrationStatus,
  LegacyPortfolioSnapshot,
} from "@dashboard/contracts";

export async function findPortfolio(
  pool: pg.Pool,
  accountId: string,
): Promise<LegacyPortfolioSnapshot | null> {
  return accountRead(pool, accountId, async (client) => {
    const latest = await client.query<{
      as_of: Date;
      source_currency: string;
      source_total_value: string;
      source_history: unknown;
      protocol_logos: Record<string, string> | null;
      snapshot_status: "live_refreshed";
    }>(`
      select live.as_of, live.reporting_currency source_currency, live.total_value::text source_total_value,
             live.snapshot source_history, 'live_refreshed'::text snapshot_status,
             (
               select jsonb_object_agg(lower(record.payload->>'name'), record.payload->>'logo_path')
               from portfolio_v2.legacy_import_records record
               where record.source_table = 'protocols'
                 and coalesce(record.payload->>'logo_path', '') <> ''
             ) as protocol_logos
      from portfolio_v2.portfolio_refresh_snapshots live
      where live.account_id=$1 and jsonb_array_length(coalesce(live.snapshot->'wallets', '[]'::jsonb)) > 0
      order by live.as_of desc
      limit 1
    `, [accountId]);
    const row = latest.rows[0];
    if (!row) return null;

    const historyResult = await client.query<{ as_of: Date; source_total_value: string }>(`
      select as_of, source_total_value::text
      from (
        select distinct on ((as_of at time zone 'Europe/Zurich')::date)
               as_of, total_value as source_total_value
        from portfolio_v2.portfolio_refresh_snapshots snapshots
        where account_id=$1 and jsonb_array_length(coalesce(snapshot->'wallets', '[]'::jsonb)) > 0
        order by (as_of at time zone 'Europe/Zurich')::date, as_of desc
      ) daily
      order by as_of
    `, [accountId]);

    const snapshot = record(row.source_history);
    const tokens = array(snapshot.tokens).map((value, index) => {
      const token = record(value);
      const chainId = stringValue(token.chain_id, "unknown");
      const symbol = stringValue(token.symbol, "Unknown");
      return {
        key: `${chainId}:${symbol}:${index}`,
        name: stringValue(token.name, symbol),
        symbol,
        chainId,
        decimals: integerValue(token.decimals),
        logoUrl: localLogoUrl(token.logo_path),
        price: decimalValue(token.price),
        price24hChange: nullableDecimalValue(token.price_24h_change),
        amount: decimalValue(token.amount),
        totalUsdValue: decimalValue(token.total_usd_value),
        wallets: array(token.wallets).map((value) => {
          const wallet = record(value);
          return { tag: stringValue(wallet.tag, "Unlabeled"), amount: decimalValue(wallet.amount) };
        }),
      };
    });
    const chains = array(snapshot.chains).map((value) => {
      const chain = record(value);
      return {
        chainId: stringValue(chain.chain_id, "unknown"),
        name: stringValue(chain.name, "Unknown network"),
        logoUrl: localLogoUrl(chain.logo_path),
        usdValue: decimalValue(chain.usd_value),
        tokenUsdValue: decimalValue(chain.token_usd_value),
        protocolUsdValue: decimalValue(chain.protocol_usd_value),
      };
    });
    const protocolLogos = row.protocol_logos ?? {};
    const protocols = array(snapshot.protocolsTable).map((value, index) => {
      const protocol = record(value);
      const name = stringValue(protocol.name, "Unknown protocol");
      return {
        key: `${slug(name)}:${index}`,
        name,
        logoUrl: localLogoUrl(protocolLogos[name.toLowerCase()]),
        totalUsdValue: decimalValue(protocol.totalUSD),
        positions: array(protocol.positions).map((value) => {
          const position = record(value);
          return {
            type: stringValue(position.type, "Position"),
            chainId: stringValue(position.chain, "unknown"),
            amount: decimalValue(position.amount),
            price: decimalValue(position.price),
            usdValue: decimalValue(position.usdValue),
            tokenNames: stringValue(position.tokenNames, "Assets"),
            walletTags: array(position.wallets).map((wallet) => stringValue(record(wallet).tag, "Unlabeled")),
          };
        }),
      };
    });

    return {
      asOf: row.as_of.toISOString(),
      currency: row.source_currency,
      totalUsdValue: row.source_total_value,
      totalTokenUsdValue: decimalValue(snapshot.totalTokenUSD),
      totalProtocolUsdValue: decimalValue(snapshot.totalProtocolUSD),
      tokens,
      chains,
      protocols,
      walletCount: array(snapshot.wallets).length,
      history: historyResult.rows.map((point) => ({
        asOf: point.as_of.toISOString(),
        totalUsdValue: point.source_total_value,
      })),
      status: row.snapshot_status,
    };
  });
}

/** @deprecated Compatibility alias for callers migrating to findPortfolio. */
export const findLegacyPortfolioSnapshot = findPortfolio;

export async function findLegacyAssets(pool: pg.Pool, accountId: string): Promise<LegacyAssetRow[]> {
  return accountRead(pool, accountId, async (client) => {
    const result = await client.query<{
      id: string;
      wallet_id: string | null;
      wallet_label: string | null;
      legacy_chain_id: string;
      symbol: string;
      name: string;
      amount: string;
      raw_amount: string;
      source_usd_value: string;
    }>(`
      select balance.id, balance.wallet_id,
             wallet_record.payload->>'tag' as wallet_label,
             token_record.payload->>'chain_id' as legacy_chain_id,
             token_record.payload->>'symbol' as symbol,
             token_record.payload->>'name' as name,
             balance.amount::text, balance.raw_amount::text, balance.source_usd_value::text
      from portfolio_v2.legacy_balance_candidates balance
      join portfolio_v2.legacy_import_records token_record
        on token_record.import_batch_id = balance.import_batch_id
       and token_record.source_table = 'tokens'
       and token_record.source_key = balance.legacy_token_key
      left join portfolio_v2.legacy_import_records wallet_record
        on wallet_record.import_batch_id = balance.import_batch_id
       and wallet_record.source_table = 'wallets'
       and wallet_record.source_key = balance.legacy_wallet_key
      where balance.account_id = $1
      order by balance.source_usd_value desc, token_record.payload->>'symbol', balance.id
    `, [accountId]);
    return result.rows.map((row) => ({
      id: row.id,
      walletId: row.wallet_id,
      walletLabel: row.wallet_label,
      legacyChainId: row.legacy_chain_id,
      symbol: row.symbol,
      name: row.name,
      amount: row.amount,
      rawAmount: row.raw_amount,
      sourceUsdValue: row.source_usd_value,
      status: "unverified",
    }));
  });
}

export async function findLegacyActivity(pool: pg.Pool, accountId: string, limit: number): Promise<LegacyActivityRow[]> {
  const safeLimit = Math.max(1, Math.min(2_000, Math.trunc(limit)));
  return accountRead(pool, accountId, async (client) => {
    const result = await client.query<{
      id: string;
      exchange: string;
      source_key: string;
      type: string | null;
      asset: string | null;
      amount: string | null;
      fee: string | null;
      transaction_amount: string | null;
      billing_amount: string | null;
      merchant: string | null;
      effective_at: Date;
      excluded_from_totals: boolean;
    }>(`
      select activity.id,
             record.payload->>'exchange' as exchange,
             activity.source_key,
             record.payload->>'type' as type,
             record.payload->>'asset' as asset,
             record.payload->>'amount' as amount,
             record.payload->>'fee' as fee,
             record.payload->>'transactionAmount' as transaction_amount,
             record.payload->>'billingAmount' as billing_amount,
             record.payload->>'merchant' as merchant,
             activity.effective_at,
             activity.excluded_from_totals
      from portfolio_v2.legacy_transaction_candidates activity
      join portfolio_v2.legacy_import_records record on record.id = activity.legacy_record_id
      where activity.account_id = $1
      order by activity.effective_at desc, activity.id
      limit $2
    `, [accountId, safeLimit]);
    return result.rows.map((row) => ({
      id: row.id,
      exchange: row.exchange,
      sourceKey: row.source_key,
      type: row.type,
      asset: row.asset,
      amount: row.amount,
      fee: row.fee,
      transactionAmount: row.transaction_amount,
      billingAmount: row.billing_amount,
      merchant: row.merchant,
      effectiveAt: row.effective_at.toISOString(),
      excludedFromTotals: row.excluded_from_totals,
      status: "unclassified",
    }));
  });
}

export async function findLegacyMigrationStatus(pool: pg.Pool, accountId: string): Promise<LegacyMigrationStatus | null> {
  return accountRead(pool, accountId, async (client) => {
    const batch = await client.query<{
      id: string;
      source_commit: string | null;
      completed_at: Date;
      source_record_count: number;
      imported_record_count: number;
      wallet_count: number;
      balance_count: number;
      transaction_count: number;
      protocol_count: number;
      snapshot_count: number;
    }>(`
      select batch.id, batch.source_commit, batch.completed_at,
             batch.source_record_count, batch.imported_record_count,
             (select count(*)::int from portfolio_v2.wallets wallet where wallet.account_id = $1) wallet_count,
             (select count(*)::int from portfolio_v2.legacy_balance_candidates item where item.import_batch_id = batch.id) balance_count,
             (select count(*)::int from portfolio_v2.legacy_transaction_candidates item where item.import_batch_id = batch.id) transaction_count,
             (select count(*)::int from portfolio_v2.legacy_protocol_candidates item where item.import_batch_id = batch.id) protocol_count,
             (select count(*)::int from portfolio_v2.legacy_unverified_snapshots item where item.import_batch_id = batch.id) snapshot_count
      from portfolio_v2.legacy_import_batches batch
      where batch.account_id = $1 and batch.status = 'succeeded'
      order by batch.completed_at desc
      limit 1
    `, [accountId]);
    const row = batch.rows[0];
    if (!row) return null;
    const quarantine = await client.query<{ reason_code: string; count: number }>(`
      select reason_code, count(*)::int as count
      from portfolio_v2.legacy_mapping_quarantine
      where import_batch_id = $1 and status = 'needs_review'
      group by reason_code order by reason_code
    `, [row.id]);
    return {
      importBatchId: row.id,
      sourceCommit: row.source_commit,
      completedAt: row.completed_at.toISOString(),
      sourceRecordCount: row.source_record_count,
      importedRecordCount: row.imported_record_count,
      walletCount: row.wallet_count,
      balanceCandidateCount: row.balance_count,
      transactionCandidateCount: row.transaction_count,
      protocolCandidateCount: row.protocol_count,
      unverifiedSnapshotCount: row.snapshot_count,
      quarantine: quarantine.rows.map((item) => ({ reason: item.reason_code, count: item.count })),
    };
  });
}

async function accountRead<T>(pool: pg.Pool, accountId: string, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("select set_config('app.account_id', $1, true)", [accountId]);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function nullableDecimalValue(value: unknown): string | null {
  return value === null || value === undefined ? null : decimalValue(value);
}

function decimalValue(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") return "0";
  const source = String(value).trim();
  if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(source)) return source;
  const match = source.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return "0";
  const [, sign, whole = "0", fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  const digits = `${whole}${fraction}`;
  const decimalIndex = whole.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${"0".repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function localLogoUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("https://")) return value;
  const filename = value.trim().split(/[\\/]/).pop();
  if (!filename || !/^[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp|gif|svg)$/i.test(filename)) return null;
  return `/logos/${encodeURIComponent(filename)}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "protocol";
}
