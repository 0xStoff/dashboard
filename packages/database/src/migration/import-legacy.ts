import { createHash } from "node:crypto";

import pg from "pg";

const IMPORTER_VERSION = "legacy-pi-v1";
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

const sourceUrl = required("LEGACY_DATABASE_URL");
const targetUrl = required("DATABASE_URL");
const snapshotSha256 = sha256Pattern(required("LEGACY_SNAPSHOT_SHA256"));
const sourceDeployment = process.env.LEGACY_SOURCE_DEPLOYMENT?.trim() || "stoffpi:/mnt/ssd_nvme/apps_deployed/dashboard";
const sourceCommit = process.env.LEGACY_SOURCE_COMMIT?.trim() || null;
const sourceDatabase = process.env.LEGACY_SOURCE_DATABASE?.trim() || "crypto_dashboard";

const mappingConfig = {
  accountModel: "single-personal-account",
  reportingCurrency: "USD",
  reportingTimezone: "Europe/Zurich",
  chainPolicy: "legacy-disabled-namespaces-until-reviewed",
  assetPolicy: "quarantine-symbol-only-assets",
  snapshotPolicy: "legacy-unverified-never-promoted",
};
const configSha256 = sha256(JSON.stringify(mappingConfig));
const accountId = deterministicUuid(`account:${sourceDeployment}:personal`);
const importBatchId = deterministicUuid(`batch:${snapshotSha256}:${IMPORTER_VERSION}:${configSha256}`);

const sourcePool = new pg.Pool({ connectionString: sourceUrl, max: 2, application_name: "portfolio-legacy-reader" });
const targetPool = new pg.Pool({ connectionString: targetUrl, max: 2, application_name: "portfolio-legacy-importer" });

try {
  const sourceVersion = process.env.LEGACY_SOURCE_SERVER_VERSION?.trim() || await scalar(sourcePool, "show server_version");
  const tableCounts = await sourceCounts(sourcePool);
  const sourceRecordCount = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);
  const referencedLegacyUserId = await scalar(sourcePool, `
    select user_id::text
    from public.wallets
    where user_id is not null
    group by user_id
    order by count(*) desc, user_id
    limit 1
  `);
  if (!referencedLegacyUserId) throw new Error("no wallet-owned legacy user could be identified");

  const client = await targetPool.connect();
  try {
    await client.query("begin");
    await client.query(`
      insert into portfolio_v2.accounts
        (id, name, reporting_currency, reporting_timezone, status)
      values ($1, $2, $3, $4, 'active')
      on conflict (id) do nothing
    `, [accountId, "Pi portfolio snapshot", mappingConfig.reportingCurrency, mappingConfig.reportingTimezone]);

    const normalizedUserId = deterministicUuid(`user:${sourceDeployment}:${referencedLegacyUserId}`);
    await client.query(`
      insert into portfolio_v2.users (id, status) values ($1, 'active')
      on conflict (id) do nothing
    `, [normalizedUserId]);
    await client.query("select set_config('app.account_id', $1, true)", [accountId]);
    await client.query(`
      insert into portfolio_v2.account_memberships (account_id, user_id, role)
      values ($1, $2, 'owner')
      on conflict (account_id, user_id) do nothing
    `, [accountId, normalizedUserId]);

    const previous = await client.query<{ status: string; manifest: unknown }>(`
      select status, manifest
      from portfolio_v2.legacy_import_batches
      where id = $1
    `, [importBatchId]);
    if (previous.rows[0]?.status === "succeeded") {
      await client.query("commit");
      console.log(JSON.stringify({ status: "already_imported", importBatchId, manifest: previous.rows[0].manifest }, null, 2));
      process.exitCode = 0;
    } else {
      await client.query(`
        insert into portfolio_v2.legacy_import_batches
          (id, account_id, source_deployment, source_database, source_snapshot_sha256,
           source_server_version, source_commit, importer_version, config_sha256, status)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'running')
        on conflict (id) do update set status = 'running', completed_at = null
      `, [importBatchId, accountId, sourceDeployment, sourceDatabase, snapshotSha256,
        sourceVersion, sourceCommit, IMPORTER_VERSION, configSha256]);

      const recordIds = new Map<string, string>();
      let importedRecordCount = 0;
      for (const table of SOURCE_TABLES) {
        const rows = await sourcePool.query<{ source_key: string; payload_text: string }>(`
          select id::text as source_key, row_to_json(source_row)::text as payload_text
          from public.${quoteIdentifier(table)} as source_row
          order by id
        `);
        for (const row of rows.rows) {
          const recordId = deterministicUuid(`record:${importBatchId}:${table}:${row.source_key}`);
          recordIds.set(`${table}:${row.source_key}`, recordId);
          await client.query(`
            insert into portfolio_v2.legacy_import_records
              (id, account_id, import_batch_id, source_table, source_key, payload, content_sha256)
            values ($1, $2, $3, $4, $5, $6::jsonb, $7)
            on conflict (import_batch_id, source_table, source_key) do nothing
          `, [recordId, accountId, importBatchId, table, row.source_key, row.payload_text, sha256(row.payload_text)]);
          importedRecordCount += 1;
        }
      }

      let quarantinedRecordCount = 0;
      const quarantine = async (
        sourceTable: string,
        sourceKey: string,
        entityKind: string,
        reasonCode: string,
        safeSummary: Record<string, unknown>,
      ) => {
        const legacyRecordId = requireRecordId(recordIds, sourceTable, sourceKey);
        const quarantineId = deterministicUuid(`quarantine:${importBatchId}:${sourceTable}:${sourceKey}:${entityKind}:${reasonCode}`);
        await client.query(`
          insert into portfolio_v2.legacy_mapping_quarantine
            (id, account_id, import_batch_id, legacy_record_id, entity_kind, reason_code, safe_summary)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          on conflict (import_batch_id, legacy_record_id, entity_kind, reason_code) do nothing
        `, [quarantineId, accountId, importBatchId, legacyRecordId, entityKind, reasonCode, JSON.stringify(safeSummary)]);
        quarantinedRecordCount += 1;
      };

      const addRef = async (
        sourceTable: string,
        sourceKey: string,
        targetTable: string,
        targetId: string,
        mappingStatus: "normalized" | "candidate" | "quarantined",
        mappingReason: string,
      ) => {
        const refId = deterministicUuid(`ref:${importBatchId}:${sourceTable}:${sourceKey}:${targetTable}:${targetId}`);
        await client.query(`
          insert into portfolio_v2.legacy_import_refs
            (id, account_id, import_batch_id, source_table, source_key, target_table,
             target_id, mapping_status, mapping_reason)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (import_batch_id, source_table, source_key, target_table, target_id) do nothing
        `, [refId, accountId, importBatchId, sourceTable, sourceKey, targetTable, targetId, mappingStatus, mappingReason]);
      };

      const legacyUsers = await sourcePool.query<{ id: string }>("select id::text as id from public.users order by id");
      for (const user of legacyUsers.rows) {
        if (user.id === referencedLegacyUserId) {
          await addRef("users", user.id, "users", normalizedUserId, "normalized", "sole legacy user referenced by tracked wallets");
        } else {
          await quarantine("users", user.id, "user_identity", "UNREFERENCED_LEGACY_USER", { legacyUserId: user.id });
        }
      }

      const walletRows = await sourcePool.query<{
        id: string;
        wallet: string;
        tag: string | null;
        chain: string | null;
      }>(`select id::text as id, wallet, tag, chain from public.wallets order by id`);
      const walletIds = new Map<string, string>();
      for (const wallet of walletRows.rows) {
        const chainReference = canonicalLegacyReference(wallet.chain || "unknown");
        const chainId = deterministicUuid(`chain:legacy-wallet:${chainReference}`);
        await client.query(`
          insert into portfolio_v2.chains (id, namespace, reference, display_name, status)
          values ($1, 'legacy-wallet', $2, $3, 'disabled')
          on conflict (namespace, reference) do nothing
        `, [chainId, chainReference, `Legacy ${wallet.chain || "unknown"}`]);
        const normalizedAddress = wallet.chain === "evm" ? wallet.wallet.trim().toLowerCase() : wallet.wallet.trim();
        const walletId = deterministicUuid(`wallet:${accountId}:${chainId}:${normalizedAddress}`);
        walletIds.set(wallet.id, walletId);
        await client.query(`
          insert into portfolio_v2.wallets
            (id, account_id, chain_id, normalized_address, address_display, wallet_kind, status)
          values ($1, $2, $3, $4, $5, $6, 'active')
          on conflict (account_id, chain_id, normalized_address) do nothing
        `, [walletId, accountId, chainId, normalizedAddress, wallet.wallet.trim(), wallet.chain === "kraken" ? "exchange" : "self_custody"]);
        await addRef("wallets", wallet.id, "wallets", walletId, "normalized", "preserved under disabled legacy chain namespace pending canonical chain review");
      }

      for (const table of ["evm_chains", "non_evm_chains"] as const) {
        const chains = await sourcePool.query<{ id: string; chain_id: string; name: string }>(`
          select id::text as id, chain_id, name from public.${quoteIdentifier(table)} order by id
        `);
        for (const chain of chains.rows) {
          await quarantine(table, chain.id, "chain_identity", "LEGACY_CHAIN_REFERENCE_NOT_CANONICAL", {
            legacyChainId: chain.chain_id,
            name: chain.name,
          });
        }
      }

      const tokenRows = await sourcePool.query<{ id: string; chain_id: string; symbol: string; name: string }>(`
        select id::text as id, chain_id, symbol, name from public.tokens order by id
      `);
      for (const token of tokenRows.rows) {
        await quarantine("tokens", token.id, "asset_identity", "MISSING_ASSET_REFERENCE", {
          legacyChainId: token.chain_id,
          symbol: token.symbol,
          name: token.name,
        });
      }

      const balances = await sourcePool.query<{
        id: string;
        wallet_id: string;
        token_id: string;
        amount: string;
        raw_amount: string;
        usd_value: string;
      }>(`
        select id::text as id, wallet_id::text, token_id::text,
               amount::text, raw_amount::text, usd_value::text
        from public.wallets_tokens order by id
      `);
      for (const balance of balances.rows) {
        const candidateId = deterministicUuid(`balance-candidate:${importBatchId}:${balance.id}`);
        await client.query(`
          insert into portfolio_v2.legacy_balance_candidates
            (id, account_id, import_batch_id, legacy_record_id, wallet_id,
             legacy_wallet_key, legacy_token_key, amount, raw_amount, source_usd_value)
          values ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10::numeric)
          on conflict (import_batch_id, legacy_record_id) do nothing
        `, [candidateId, accountId, importBatchId, requireRecordId(recordIds, "wallets_tokens", balance.id),
          walletIds.get(balance.wallet_id) ?? null, balance.wallet_id, balance.token_id,
          balance.amount, balance.raw_amount, balance.usd_value]);
        await addRef("wallets_tokens", balance.id, "legacy_balance_candidates", candidateId, "candidate", "quantity preserved; asset identity unresolved");
        await quarantine("wallets_tokens", balance.id, "balance", "UNRESOLVED_LEGACY_TOKEN", { legacyTokenId: balance.token_id });
      }

      const positions = await sourcePool.query<{
        id: string;
        wallet_id: string;
        protocol_id: string;
        position_text: string | null;
      }>(`
        select id::text as id, wallet_id::text, protocol_id::text,
               portfolio_item_list::text as position_text
        from public.wallets_protocols order by id
      `);
      for (const position of positions.rows) {
        const candidateId = deterministicUuid(`protocol-candidate:${importBatchId}:${position.id}`);
        await client.query(`
          insert into portfolio_v2.legacy_protocol_candidates
            (id, account_id, import_batch_id, legacy_record_id, wallet_id,
             legacy_wallet_key, legacy_protocol_key, opaque_position)
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          on conflict (import_batch_id, legacy_record_id) do nothing
        `, [candidateId, accountId, importBatchId, requireRecordId(recordIds, "wallets_protocols", position.id),
          walletIds.get(position.wallet_id) ?? null, position.wallet_id, position.protocol_id, position.position_text]);
        await addRef("wallets_protocols", position.id, "legacy_protocol_candidates", candidateId, "candidate", "opaque provider position preserved for adapter-versioned normalization");
        await quarantine("wallets_protocols", position.id, "protocol_position", "OPAQUE_LEGACY_POSITION", { legacyProtocolId: position.protocol_id });
      }

      const transactions = await sourcePool.query<{
        id: string;
        exchange: string;
        order_no: string | null;
        effective_at: string;
        excluded: boolean;
      }>(`
        select id::text as id, exchange, "orderNo" as order_no, date::text as effective_at,
               "excludedFromTotals" as excluded
        from public.transactions order by id
      `);
      for (const transaction of transactions.rows) {
        const candidateId = deterministicUuid(`transaction-candidate:${importBatchId}:${transaction.id}`);
        await client.query(`
          insert into portfolio_v2.legacy_transaction_candidates
            (id, account_id, import_batch_id, legacy_record_id, source_namespace,
             source_key, effective_at, excluded_from_totals)
          values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8)
          on conflict (import_batch_id, legacy_record_id) do nothing
        `, [candidateId, accountId, importBatchId, requireRecordId(recordIds, "transactions", transaction.id),
          canonicalLegacyReference(transaction.exchange), transaction.order_no || transaction.id,
          transaction.effective_at, transaction.excluded]);
        await addRef("transactions", transaction.id, "legacy_transaction_candidates", candidateId, "candidate", "global legacy transaction preserved pending ownership and classification review");
      }

      const snapshots = await sourcePool.query<{
        id: string;
        as_of: string;
        total_value: string;
        history_text: string | null;
      }>(`
        select id::text as id, date::text as as_of, "totalNetWorth"::text as total_value,
               history::text as history_text
        from public."net-worths" order by id
      `);
      for (const snapshot of snapshots.rows) {
        const snapshotId = deterministicUuid(`legacy-snapshot:${importBatchId}:${snapshot.id}`);
        await client.query(`
          insert into portfolio_v2.legacy_unverified_snapshots
            (id, account_id, import_batch_id, legacy_record_id, as_of,
             source_currency, source_total_value, source_history)
          values ($1, $2, $3, $4, $5::timestamptz, 'USD', $6::numeric, $7::jsonb)
          on conflict (import_batch_id, legacy_record_id) do nothing
        `, [snapshotId, accountId, importBatchId, requireRecordId(recordIds, "net-worths", snapshot.id),
          snapshot.as_of, snapshot.total_value, snapshot.history_text]);
        await addRef("net-worths", snapshot.id, "legacy_unverified_snapshots", snapshotId, "candidate", "browser-authored snapshot preserved but never promoted as authoritative");
      }

      const settings = await sourcePool.query<{ id: string; key: string }>("select id::text as id, key from public.settings order by id");
      for (const setting of settings.rows) {
        await quarantine("settings", setting.id, "account_policy", "GLOBAL_SETTING_REQUIRES_OWNER_REVIEW", { key: setting.key });
      }

      const manifest = {
        sourceDeployment,
        sourceDatabase,
        sourceSnapshotSha256: snapshotSha256,
        sourceServerVersion: sourceVersion,
        sourceCommit,
        importerVersion: IMPORTER_VERSION,
        configSha256,
        mappingConfig,
        tableCounts,
        sourceRecordCount,
        importedRecordCount,
        quarantinedRecordCount,
      };
      await client.query(`
        update portfolio_v2.legacy_import_batches
        set status = 'succeeded', source_record_count = $2,
            imported_record_count = $3, quarantined_record_count = $4,
            manifest = $5::jsonb, completed_at = now()
        where id = $1
      `, [importBatchId, sourceRecordCount, importedRecordCount, quarantinedRecordCount, JSON.stringify(manifest)]);
      await client.query("commit");
      console.log(JSON.stringify({ status: "succeeded", importBatchId, accountId, manifest }, null, 2));
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await Promise.all([sourcePool.end(), targetPool.end()]);
}

async function sourceCounts(pool: pg.Pool): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of SOURCE_TABLES) {
    const result = await pool.query<{ count: string }>(`select count(*)::text as count from public.${quoteIdentifier(table)}`);
    counts[table] = Number(result.rows[0]?.count ?? "0");
  }
  return counts;
}

async function scalar(pool: pg.Pool, query: string): Promise<string> {
  const result = await pool.query<Record<string, unknown>>(query);
  const value = result.rows[0] ? Object.values(result.rows[0])[0] : undefined;
  return value === undefined || value === null ? "" : String(value);
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

function canonicalLegacyReference(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "unknown";
}

function requireRecordId(records: Map<string, string>, table: string, key: string): string {
  const id = records.get(`${table}:${key}`);
  if (!id) throw new Error(`missing imported record ${table}:${key}`);
  return id;
}

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Pattern(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("LEGACY_SNAPSHOT_SHA256 must be a lowercase SHA-256 digest");
  return value;
}
