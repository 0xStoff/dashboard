import type pg from "pg";

import type { PortfolioSummary } from "@dashboard/contracts";

interface SnapshotRow {
  account_id: string;
  as_of: Date;
  reporting_currency: string;
  net_worth: string | null;
  cost_basis: string | null;
  unrealized_pnl: string | null;
  completeness: PortfolioSummary["netWorth"]["completeness"];
  confidence: PortfolioSummary["netWorth"]["confidence"];
  unpriced_asset_count: number;
  unknown_event_count: number;
  calculation_id: string;
  warnings: PortfolioSummary["warnings"];
}

interface LegacySnapshotRow {
  as_of: Date;
  source_currency: string;
  source_total_value: string;
  unpriced_asset_count: number;
  unknown_event_count: number;
}

export async function findLatestPortfolioSummary(
  pool: pg.Pool,
  accountId: string,
  reportingCurrency: string,
): Promise<PortfolioSummary> {
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("select set_config('app.account_id', $1, true)", [accountId]);
    const result = await client.query<SnapshotRow>(`
      select account_id, as_of, reporting_currency, net_worth, cost_basis, unrealized_pnl,
             completeness, confidence, unpriced_asset_count, unknown_event_count,
             calculation_id, warnings
      from portfolio_v2.portfolio_snapshots
      where account_id = $1
      order by as_of desc
      limit 1
    `, [accountId]);
    const row = result.rows[0];
    if (!row) {
      const legacy = await client.query<LegacySnapshotRow>(`
        select snapshot.as_of, snapshot.source_currency, snapshot.source_total_value,
          (select count(*)::int from portfolio_v2.legacy_mapping_quarantine quarantine
            where quarantine.account_id = $1 and quarantine.reason_code = 'MISSING_ASSET_REFERENCE'
              and quarantine.status = 'needs_review') as unpriced_asset_count,
          (select count(*)::int from portfolio_v2.legacy_transaction_candidates activity
            where activity.account_id = $1 and activity.status = 'unclassified') as unknown_event_count
        from portfolio_v2.legacy_unverified_snapshots snapshot
        join portfolio_v2.legacy_import_batches batch on batch.id = snapshot.import_batch_id
        where snapshot.account_id = $1 and batch.status = 'succeeded'
        order by snapshot.as_of desc
        limit 1
      `, [accountId]);
      await client.query("commit");
      const legacyRow = legacy.rows[0];
      return legacyRow ? legacySummary(accountId, legacyRow) : unavailableSummary(accountId, reportingCurrency);
    }
    await client.query("commit");
    const metric = (amount: string | null) => ({
      amount,
      currency: row.reporting_currency,
      completeness: row.completeness,
      confidence: row.confidence,
      calculationId: row.calculation_id,
    });
    return {
      accountId: row.account_id,
      asOf: row.as_of.toISOString(),
      reportingCurrency: row.reporting_currency,
      netWorth: metric(row.net_worth),
      costBasis: metric(row.cost_basis),
      unrealizedPnl: metric(row.unrealized_pnl),
      freshness: Date.now() - row.as_of.getTime() < 15 * 60_000 ? "fresh" : "stale",
      unpricedAssetCount: row.unpriced_asset_count,
      unknownEventCount: row.unknown_event_count,
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function legacySummary(accountId: string, row: LegacySnapshotRow): PortfolioSummary {
  const unknownMetric = {
    amount: null,
    currency: row.source_currency,
    completeness: "unknown" as const,
    confidence: "unknown" as const,
    calculationId: null,
  };
  return {
    accountId,
    asOf: row.as_of.toISOString(),
    reportingCurrency: row.source_currency,
    netWorth: {
      amount: row.source_total_value,
      currency: row.source_currency,
      completeness: "partial",
      confidence: "low",
      calculationId: null,
    },
    costBasis: unknownMetric,
    unrealizedPnl: unknownMetric,
    freshness: "stale",
    unpricedAssetCount: row.unpriced_asset_count,
    unknownEventCount: row.unknown_event_count,
    warnings: [
      {
        code: "LEGACY_UNVERIFIED_SNAPSHOT",
        message: "This value was imported from the old browser-authored dashboard and has not been reconciled or promoted.",
      },
    ],
  };
}

function unavailableSummary(accountId: string, reportingCurrency: string): PortfolioSummary {
  const metric = {
    amount: null,
    currency: reportingCurrency,
    completeness: "unknown" as const,
    confidence: "unknown" as const,
    calculationId: null,
  };
  return {
    accountId,
    asOf: null,
    reportingCurrency,
    netWorth: metric,
    costBasis: metric,
    unrealizedPnl: metric,
    freshness: "unavailable",
    unpricedAssetCount: 0,
    unknownEventCount: 0,
    warnings: [{ code: "NO_PROMOTED_SNAPSHOT", message: "No verified portfolio snapshot is available yet." }],
  };
}
