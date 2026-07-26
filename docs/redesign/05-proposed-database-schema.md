# Proposed database schema

## Conventions

- New objects live in a separate `portfolio_v2` schema during migration; legacy tables remain untouched.
- Primary keys are application-generated UUIDs. Public APIs use opaque IDs, never sequential legacy IDs.
- All time values are `TIMESTAMPTZ` in UTC. Source-local dates retain original zone/offset metadata where supplied.
- Every mutable/user-owned table has `account_id UUID NOT NULL` and a foreign key to `accounts`.
- Authoritative decimals are returned to TypeScript as strings.
- Atomic blockchain quantities use `NUMERIC(100,0)` (or validated integer text if a provider exceeds that bound). Normalized quantities are derived, not the source of truth.
- Prices use `NUMERIC(60,30)`; reporting values and cost basis use `NUMERIC(48,18)`. Currency-specific presentation rounding happens only at reporting boundaries.
- All mutable domain rows have `created_at`, and where applicable `updated_at`, `version`, and actor/source lineage.
- Foreign keys default to `RESTRICT`. Deletion is explicit; financial/provenance records use tombstone/status semantics rather than cascades.
- Drizzle provides TypeScript schema/query types. Reviewed SQL migrations are checked in and applied only by a migration command.

## Ownership and authentication

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `accounts` | Tenant/portfolio owner | `id`, `name`, `reporting_currency`, `reporting_timezone`, `status`; unique normalized name only if product needs it |
| `users` | Human/auth identity | `id`, `status`, `created_at`; no portfolio values |
| `user_wallet_identities` | Account-scoped wallets permitted to authenticate | `account_id`, `user_id`, `chain_id`, normalized address, verified time; unique `(account_id,chain_id,address)` according to enrollment policy |
| `account_memberships` | User/account role | `account_id`, `user_id`, role (`owner/admin/editor/viewer`); unique pair |
| `sessions` | Revocable server session | `id`, `user_id`, current `account_id`, `token_hash`, created/last_seen/expires/revoked, IP/user-agent hashes; unique token hash |
| `auth_challenges` | SIWE nonce lifecycle | intended `account_id`, `id`, address/domain/URI/chain/nonce, issued/expires/consumed; unique nonce; one active challenge policy |

`users`, sessions, and identities are user-owned security data; portfolio/domain rows are account-owned. Membership checks happen before account context is set.

## Reference identity and wallets

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `chains` | On-chain/off-chain namespaces | `id`, `namespace`, `reference`, display metadata, address codec, status; unique `(namespace,reference)` |
| `wallets` | Tracked address/account | `account_id`, `chain_id`, `normalized_address`, `address_display`, `wallet_kind`, status; unique `(account_id,chain_id,normalized_address)` |
| `wallet_labels` | Audited display labels | `account_id`, `wallet_id`, `label`, validity/version/actor; no behavior keyed to label |
| `assets` | Canonical chain-scoped asset identity | `chain_id`, `asset_namespace`, `asset_reference`, decimals if authoritative, status; unique `(chain_id,asset_namespace,asset_reference)` |
| `asset_metadata` | Versioned display metadata | `asset_id`, source, valid_from/to, symbol/name/logo URI/content hash, verification; unique active source/version |
| `asset_groups` | Reviewed economic/fungibility grouping | `account_id NOT NULL` for account-created groups, name, group type, review state; optional platform-global mappings live in a separate read-only catalog |
| `asset_group_members` | Cross-chain aggregation mapping | group, asset, conversion ratio, validity, evidence; unique `(group_id,asset_id,valid_from)` |
| `provider_asset_mappings` | External ID → asset | provider, provider chain/reference, asset ID, confidence/status/evidence; unique provider identity mapping |

Examples:

| Source | Chain identity | Asset namespace | Asset reference |
|---|---|---|---|
| EVM native | `eip155:<chainId>` | `native` | canonical native identifier |
| EVM ERC-20 | `eip155:<chainId>` | `erc20` | lowercased checksummed contract bytes |
| Solana | `solana:<genesis/reference>` | `spl` | mint public key |
| Cosmos | `cosmos:<chain-id>` | `denom` | exact base denom/IBC hash/factory denom |
| Sui | `sui:<network>` | `coin` | canonical coin type |
| Aptos | `aptos:<network>` | `coin` | canonical type tag |
| Hyperliquid | `hyperliquid:mainnet` | `spot` | provider numeric/asset identifier, not symbol |
| CEX | `cex:<venue>` | `asset` | venue asset code; reviewed group may link economic equivalent |

Symbols, names, provider IDs, and logos never participate in canonical uniqueness.

## Provider connections and durable work

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `provider_connections` | Account/provider configuration | `account_id`, provider, label, encrypted credential envelope, key version, status, budget; unique active label/provider as appropriate |
| `provider_connection_wallets` | Explicit connection scope | account, connection, wallet, capability; unique tuple |
| `sync_jobs` | Durable queue | account, connection, wallet/chain, capability, request JSON, priority, scheduled/lease/cancel/attempt fields, idempotency key |
| `sync_runs` | One logical sync execution | required account/wallet/chain/provider/adapter/range/status/times/counts/cost/rate/error/warning/checkpoint/freshness/reconciliation summary |
| `sync_attempts` | Retry detail | run, attempt number, worker, start/end/status/error/rate-limit; unique `(run_id,attempt_no)` |
| `sync_checkpoints` | Last accepted cursor per stream | account, connection, wallet/chain, capability, cursor JSON, observation/run/version; unique stream identity |
| `outbox_events` | Transactional notifications | account, topic, aggregate/id, payload, created/published/attempt fields |

A partial unique index on `sync_jobs` prevents two active jobs with the same idempotency key. Leases have indexes on `(status, scheduled_at, priority)` and `lease_expires_at`.

## Immutable source and normalization

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `raw_observations` | Sanitized immutable provider response/page/event | account, run/attempt, connection, wallet/chain, endpoint/capability, source key, request fingerprint, payload JSONB/bytes/archive locator, `content_sha256`, received/observed/effective times, page/cursors, schema version, HTTP/rate/cost metadata; immutable trigger; content uniqueness |
| `raw_observation_supersessions` | Provider correction lineage | old/new observation, reason; unique pair; never deletes old |
| `normalization_batches` | Replay/version boundary | account, run, normalizer/version, start/end/status/counts |
| `normalized_facts` | Generic validated provider facts where a typed domain table is not yet available | account, batch, observation, fact namespace/source key/version, typed payload; unique version key |
| `rejected_observations` | Non-secret validation failures | account, observation, stage, reason code, field paths, adapter version |

Raw rows are append-only. A database trigger rejects `UPDATE`/`DELETE` for the runtime role. Retention may replace `payload` with an encrypted archive locator only after hash/size/archive verification; the metadata and provenance row remain.

## Canonical events and ledger

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `transfers` | Canonical transfer with legs/identity | account, source fact/observation, chain/tx/log/event IDs, from/to wallet or external address, asset, atomic quantity, time, status; provider/source uniqueness |
| `trades` | Exchange of assets | account, venue/chain, source, base/quote assets and atomic quantities, time, status |
| `ledger_events` | Versioned classified economic event | account, event type/category/status/time, source group, classification version, supersedes/reversal, explanation |
| `ledger_postings` | Balanced multi-commodity postings | account, event, ledger account, asset, signed atomic quantity, reporting value/price nullable, role; invariant checks via deferred validation |
| `cash_flows` | Derived external flows/read support | account, ledger event, kind, reporting value, currency, price, reporting-policy version; unique event/policy |
| `classification_rules` | Audited matching rules | account, version, priority, matcher/action JSON schemas, scope, created actor/reason, effective/retired times |
| `manual_adjustments` | Audited one-time or rule-backed correction | account, target/event, original/new classification/value, reason, actor/time/evidence, scope, status, reverses ID |
| `position_lots` | Acquisition lots | account, asset, wallet/ledger account, acquired event/time, original/remaining atomic qty, cost currency/value, basis status/cause, method version |
| `lot_consumptions` | Disposal-to-lot allocation | account, disposal event, lot, atomic qty, cost basis, proceeds/fees; unique event/lot sequence |

`ledger_accounts` is an additional table defining asset, external-contribution, external-distribution, spending, income, fee, and clearing accounts. Every event balances to zero per asset across postings. Reporting-value fields do not replace commodity quantities.

## Prices, balances, positions, and read models

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `prices` | Immutable price observations/selections | account nullable for global data, asset, quote currency, timestamp/bucket, price, provider, confidence, lookup method, observed/interpolated/carried/manual method, observation, policy; uniqueness by source/bucket |
| `price_selections` | Resolver decision | account, asset/currency/bucket, selected price, resolver version, alternatives/warnings; unique policy/bucket |
| `balance_observations` | Provider-reported balance | account, observation/run, wallet/location, asset, atomic quantity, block/slot/time, completeness |
| `current_balances` | Promoted projection pointer/value | account, projection version, wallet/location, asset, atomic quantity, source run, observed/projected times, freshness/confidence; unique active location/asset |
| `protocol_positions` | Normalized DeFi/locked/debt position | account, protocol identity, wallet, position source ID/type/status, components, source/run/time; no opaque provider JSON as sole authority |
| `position_components` | Assets/debts/rewards in a protocol position | account, position, role, asset, atomic quantity, price/value refs nullable |
| `reconciliation_checks` | Source vs projection invariant | account, run/projection, check type/scope, expected/actual/difference/tolerance, status, details |
| `projection_versions` | Atomic promotion unit | account, source cut, projector/version, status, built/promoted times; one active per model type |
| `portfolio_snapshots` | Immutable calculated point-in-time portfolio | account, projection/valuation/reporting policy versions, as-of, currency, numeric results, completeness/confidence, calculation ID; unique version set |
| `portfolio_read_models` | API-optimized JSON/columns | account, model type/version/as-of, payload, warnings, calculation ID; replaceable cache backed by immutable sources |
| `calculation_explanations` | Formula/source lineage | account, metric/formula version, included/excluded source refs, price/adjustment refs, time/confidence/warnings |

Never update an existing snapshot's financial values. Rebuilds insert a new version and retain the superseded result for comparison.

## Audit and operations

| Table | Purpose | Key columns and constraints |
|---|---|---|
| `audit_log` | Append-only security/domain command trail | account, actor user/session/service, action, target type/id, before/after hashes or safe diffs, reason, request/trace, timestamp; immutable role |
| `provider_usage_daily` | Cost/budget read model | account, connection/provider/endpoint/day, calls/credits/bytes/429s, estimate/actual |
| `backup_runs` | Backup evidence metadata only | deployment, started/completed/status, encrypted artifact/checksum location, size, retention, error; never encryption key |
| `restore_tests` | Restore evidence | backup run, environment, start/end/status, verification checks/counts, operator |

## Essential uniqueness and indexes

- `wallets(account_id, chain_id, normalized_address)` unique.
- `assets(chain_id, asset_namespace, asset_reference)` unique.
- `provider_asset_mappings(provider, provider_chain_ref, provider_asset_ref, valid_from)` unique.
- `raw_observations(account_id, provider_connection_id, capability, source_key, content_sha256)` unique when source key exists; a request/page fingerprint uniqueness path for snapshot responses.
- `transfers(account_id, chain_id, tx_hash, event_index, asset_id, leg_index)` unique for on-chain legs; equivalent provider namespace keys off-chain.
- `trades(account_id, provider_connection_id, provider_trade_id)` unique.
- `ledger_events(account_id, source_group_key, classifier_version, version)` unique.
- `ledger_postings(account_id, ledger_event_id, posting_index)` unique.
- `prices(asset_id, quote_currency, price_timestamp, provider, lookup_method, observation_id)` unique.
- `current_balances(account_id, projection_version_id, wallet_id, location_key, asset_id)` unique.
- Partial indexes for active sessions, active rules, active jobs, stale projections, unresolved reconciliation, unpriced assets, and needs-review events.
- Time/BRIN indexes for observations, prices, audit log, and events; partition only after measured size justifies it.

## Row-level security

For all account-owned tables:

```sql
ALTER TABLE portfolio_v2.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_v2.wallets FORCE ROW LEVEL SECURITY;

CREATE POLICY account_isolation ON portfolio_v2.wallets
USING (account_id = current_setting('app.account_id', true)::uuid)
WITH CHECK (account_id = current_setting('app.account_id', true)::uuid);
```

The API/worker runtime role must not own tables and must not have `BYPASSRLS`. Each unit of work opens a transaction, verifies membership/job ownership, sets `SET LOCAL app.account_id`, and executes repositories inside that transaction. Global reference tables have explicit read-only policies. Migration/backup roles are separate and unavailable to application containers.

## Migration mapping rules

- Preserve legacy primary key/table/source in `legacy_import_refs`; never treat legacy symbol as canonical identity without mapping evidence.
- Unresolved token rows import into a quarantine mapping queue and do not merge. Their balances remain unknown/unmapped but preserved.
- Legacy transaction rows import as raw legacy observations plus candidate events. `orderNo` is namespaced by legacy exchange and row provenance.
- Legacy net-worth JSON imports as `legacy_unverified_snapshot`; it is not promoted as a v2 authoritative snapshot.
- Exclusions/hardcoded corrections import as proposed adjustments/rules requiring owner review, retaining old/new evidence.
- Import is repeatable and idempotent by legacy source key and content hash.

## Schema acceptance criteria

- Every listed minimum table exists or has a documented normalized replacement.
- Every account-owned table has enforced ownership, indexes, and tenant-isolation tests.
- No symbol/name is a key and no financial decimal is mapped to JavaScript `number`.
- Raw observations and audit log reject runtime update/delete.
- Duplicate event/job fixtures violate or safely converge under explicit uniqueness constraints.
- Migrations run against empty and production-like snapshots; restoration is tested before production apply.
