# Migration and rollback plan

## Non-negotiable safety rules

- Production/Pi actions require a separate explicit authorization.
- Obtain and restore-test an encrypted backup before any production migration/import.
- Legacy application tables and code remain intact and runnable through parallel run and the retention period.
- New database objects use `portfolio_v2`; migration/import roles cannot write legacy tables.
- Never infer asset identity from symbol/name or replace unknown values with zero.
- Every import is content-addressed, repeatable, and produces a report before promotion.
- Rollback uses routing/previous images or verified restore, not destructive/unverified down migrations.

## Phase 0 — Inventory, evidence, and characterization

**Objective:** Freeze understanding of the legacy system and create a recoverable, testable baseline without changing production data.

Work:

- Documentation gate (this set), architecture/data-flow/threat model/risk register.
- With later authorization: read-only live schema/index/constraint/extension/size/row-count inventory and redacted configuration fingerprint.
- Record legacy formulas, hardcoded exceptions, exclusion rows, data freshness, provider endpoints, actual DeBank credits, known incidents.
- Encrypted off-device backup and isolated restore test.
- Characterization fixtures/tests around current routes/calculations/sync preservation.
- Produce anonymized or synthetic production-like migration snapshot.

**Acceptance:** owner approves blocking definitions; backup restores; legacy checksums/counts recorded; current behavior fixtures pass or documented failures are frozen; no production mutation.

**Rollback:** not applicable; work is read-only/documentation. Remove only disposable local test environments if needed.

## Phase 1 — Monorepo and foundations

**Objective:** Establish new build/runtime/security/test foundations while the legacy app remains runnable.

Work:

- Workspace layout, one lockfile, TypeScript strictness, lint/format/boundaries.
- Domain decimal types and TypeBox contracts.
- Fastify/web/worker skeletons and health endpoints; no provider write paths.
- Drizzle schema definitions plus checked-in SQL migration runner/ledger.
- CI, Testcontainers, Vitest/fast-check/Playwright foundations.
- Validated config, structured logging/redaction, telemetry interfaces.

**Acceptance:** legacy commands remain; three v2 runtimes build/test; no API imports provider adapters; production config fails closed; empty DB migration/restore tests pass; ARM64 build smoke passes.

**Rollback:** delete/disable additive v2 artifacts in development only; production has not changed.

## Phase 2 — Additive schema and repeatable import

**Objective:** Create `portfolio_v2` beside legacy and copy source evidence without deleting or reinterpreting originals.

Import order:

1. Accounts/users/memberships/wallets with explicit owner mapping.
2. Chains and canonical assets/provider mappings; unresolved mappings quarantined.
3. Legacy current token/protocol rows as `legacy_current_state` observations, not authoritative history.
4. Transactions as namespaced legacy observations/candidate events.
5. Net-worth JSON as `legacy_unverified_snapshot` evidence.
6. Exclusions/hardcoded corrections as proposed audited adjustments/rules.
7. Static/manual configuration as source evidence with owner/evidence review.

**Acceptance:** import is idempotent; legacy checksums/counts unchanged; every imported row maps or appears in quarantine with cause; every v2 row has account/source; no cross-tenant tests fail; migration against production-like snapshot meets lock/time/disk budget.

**Rollback:** stop import/API/worker and drop only the newly created v2 test/development schema if explicitly approved; in production prefer leaving additive schema disabled. Legacy app is untouched.

## Phase 3 — Provider adapters and immutable sync

**Objective:** Fetch into immutable observations with durable runs/jobs/checkpoints while legacy remains the visible system.

Work:

- Queue/lease/cancellation/outbox.
- Prioritized adapters: choose owner-approved order based on value/cost/risk.
- Sanitized fixture recording, schema validation, retry/rate/budget policy.
- Observation retention/archive and provider usage.
- Shadow sync schedules coordinated to avoid double paid use.

**Acceptance:** adapter conformance suite passes; secrets never persist/log; duplicate/retry/correction/partial fixtures converge; every run has required metadata/cost/checkpoint; failed/partial sync cannot erase accepted state.

**Rollback:** disable schedules/connections and stop worker. Immutable observations remain for diagnosis; legacy remains live.

## Phase 4 — Normalization, ledger, prices, projections, reconciliation

**Objective:** Produce defensible v2 events, balances, lots, valuations, and snapshots from preserved observations.

Work:

- Canonical facts/events/linking/classification.
- Double-entry postings, FIFO lots, missing-basis propagation.
- Price/FX observations and resolver.
- Current balances/protocol positions and reconciliation.
- Versioned metrics/explanations/read models.

**Acceptance:** required fixture/property/reconciliation tests pass; replay is deterministic; unknown remains typed unknown; internal transfers/bridges neutral; no P&L with incomplete basis; snapshot creation is worker-only from accepted projection/price cut.

**Rollback:** stop projection promotion and reactivate prior projection version. Do not delete observations/events; fix with a new algorithm/version and rebuild.

## Phase 5 — Old-versus-new comparison

**Objective:** Explain every material difference for every wallet/date/statistic before UI/cutover reliance.

Work:

- Generate account/wallet/asset/date/metric comparison.
- Classify identity, duplicate, price, timing, precision, classification, source-completeness, and legacy-exception differences.
- Resolve/review quarantine, unknown events, basis, and material reconciliation gaps.
- Owner signs agreed differences/formula policies.

**Acceptance:** no material unresolved differences; accepted differences have evidence/reason/owner; provider/source cuts are comparable; report is reproducible and archived.

**Rollback:** no legacy change. Reject v2 projection/formula version, correct/rebuild, and rerun.

## Phase 6 — New read API and web application

**Objective:** Deliver the five-area UX from real v2 migrated/shadow data.

Work:

- Typed read models/API, SIWE/session/security/roles.
- Overview, Holdings, Activity, Performance, Data Health and settings.
- Explanation drawer, review/rule/adjustment workflows.
- Responsive/accessibility/error/freshness states and bundle budgets.
- No Robinhood-specific chart or dedicated accounting surface in this version.

**Acceptance:** required Playwright/accessibility/security flows pass; all displayed values have explanation/freshness/completeness; no placeholder/fake data in finished views; unknown is not zero; responsive targets have no core horizontal overflow.

**Rollback:** keep v2 routes disabled/feature-flagged; legacy frontend/API remains default. Revert to previous compatible v2 image for local defects.

## Phase 7 — Parallel operation and recovery rehearsal

**Objective:** Run legacy and v2 side-by-side long enough to verify stability, provider budgets, backups, and restore.

Work:

- Scheduled comparison reports and freshness/reconciliation alerts.
- Monitor Pi resource, queue, provider credits, errors, unknown/unpriced/basis queues.
- User acceptance over representative daily/period-close flows.
- Encrypted backup/restore and full cutover/rollback rehearsal.

**Acceptance:** owner-approved soak period; no material unexplained differences; SLO/budget/resource thresholds met; current restore/rollback evidence; explicit owner cutover authorization.

**Rollback:** stop v2 schedules/UI and return entirely to legacy; preserve v2 data/evidence for correction.

## Phase 8 — Controlled cutover and retention

**Objective:** Route normal use to v2 while retaining a fast, rehearsed fallback.

Work:

- Pre-cutover backup/health/comparison/decision record.
- Switch same-origin proxy/default UI; ramp workers and monitor.
- Freeze legacy writes only if owner authorizes and fallback design permits; keep legacy read/reference capability.
- After retention and separate approval, archive old tables/code—never delete implicitly.

**Acceptance:** smoke/auth/read/sync/adjustment/data-health checks pass; metrics/alerts stable; backup and legacy fallback available; owner confirms cutover.

**Rollback triggers:** security/isolation failure, data-loss/corruption signal, material unexplained financial difference, failed backup/restore, provider budget breach, sustained resource exhaustion, or critical UX/auth outage.

**Rollback:** stop v2 writers, route to legacy/previous images, preserve all evidence, restore only if database integrity requires it, and open an incident/reconciliation report.

## Legacy-to-v2 mapping

| Legacy source | v2 handling | Important caveat |
|---|---|---|
| `users` | users/auth identities/accounts after owner mapping | Legacy main wallet login is not sufficient membership proof |
| `wallets` | account-owned wallets + labels | Normalize/validate by chain; global uniqueness not carried forward |
| `evm_chains`, `non_evm_chains` | chain candidates/reference metadata | Resolve canonical namespace/reference; endpoints are config, not identity |
| `tokens` | asset mapping candidates + metadata | No contract/mint exists; must use live/provider evidence or quarantine |
| `wallets_tokens` | legacy current balance observation | No observed time/source; not historical truth |
| `protocols`, `wallets_protocols` | legacy position observation | Opaque JSON/version/duplication concerns |
| `transactions` | namespaced raw legacy observation + candidate event | Global IDs/ownership/sign/value ambiguity; preserve exact row |
| `net-worth*` | legacy unverified snapshot evidence | Browser-authored/global/mutable; not v2 authority |
| `settings` | proposed account policy | Legacy global value needs owner assignment |
| private static data | proposed manual observation/adjustment | Review owner, evidence, timestamp, scope; never commit secret/private content |
| hardcoded closed/balance scripts | proposed adjustment/rule records | Original code/commit retained as evidence; no automatic approval |

## Data verification manifest

Each import run records:

- Legacy schema/version fingerprint and read-only connection identity.
- Per-table row count, primary-key range/count, stable content checksum strategy.
- Importer version/config hash/account mapping decision IDs.
- Inserted/mapped/quarantined/skipped/rejected counts with reason codes.
- V2 row counts/content hashes/source-reference coverage.
- Start/end/status/errors/warnings/operator.

No manifest contains secrets or full sensitive row payloads.

## Parallel-run comparison dimensions

- Wallet × canonical/legacy asset: quantity, price time/source, value, freshness.
- Protocol position/component: identity, quantity/debt/reward, value, duplication.
- Activity: source event coverage, classification, signs, value, exclusion/adjustment.
- Cash flows: contribution/distribution/spending by day/provider/wallet.
- Net worth/result/P&L: formula/source cut, complete/incomplete state.
- Provider operations: calls/credits, latency, partial/failure, checkpoint.

## Cutover approval packet

- Release/image/migration/config fingerprints.
- Current backup and restore evidence.
- Final old-vs-new and unresolved/quarantine report.
- Security/tenant/accounting/provider/UI/deployment test summaries.
- Pi resource/provider budget soak summary.
- Known residual risks and rollback compatibility window.
- Named owner approval, scheduled window, monitoring owner, and abort thresholds.

## Retention and archival

Legacy tables/code remain available read-only for an owner-approved period. Raw observation archive/financial/audit/security retention are separate decisions. Archival is encrypted, checksummed, indexed by provenance, and restore-tested. Deletion requires a distinct approved plan and audit event; it is not part of ordinary migration completion.
