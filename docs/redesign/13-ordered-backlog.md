# Ordered backlog

## Sizing and priority

Effort is an idealized single-engineer range, not a delivery promise: `XS ≤1 day`, `S 2–3`, `M 4–7`, `L 8–15`, `XL 16+`. Actual time depends on live data/provider access, owner decisions, Pi resources, and discovered migration issues.

Risk: `C` critical, `H` high, `M` medium, `L` low. Items are ordered; work must not skip a blocking dependency.

## Phase 0 — Inventory and characterization

**Objective:** establish recoverable legacy evidence and approved definitions without production mutation.

**Acceptance:** documentation/decisions complete, live read-only inventory captured under approval, encrypted backup restores, behavior fixtures characterize known paths/failures.

| Order | ID | Work item | Effort | Risk | Dependencies | Status |
|---:|---|---|---:|:---:|---|---|
| 1 | P0-01 | Complete audit/architecture/risk/schema/accounting/provider/security/UX/deployment/test/migration/backlog/decision documents | L | H | None | Complete in this branch |
| 2 | P0-02 | Resolve blocking owner decisions and record accepted formulas/policies/scope | S–M | C | P0-01 | Pending owner |
| 3 | P0-03 | Authorize and produce encrypted off-device production backup | M | C | D-ops decisions | Not authorized |
| 4 | P0-04 | Isolated restore test with checksum/row/schema verification and measured RPO/RTO candidate | M | C | P0-03 | Pending |
| 5 | P0-05 | Read-only live DB/schema/index/size/count/config/provider inventory; redact report | M | H | Explicit prod/Pi authorization, P0-03 | Pending |
| 6 | P0-06 | Inventory legacy calculations, exceptions, exclusions, formula-by-commit/time, provider ranges/costs | M | H | P0-05 | Pending |
| 7 | P0-07 | Create sanitized/anonymized production-like migration snapshot | M | H | P0-04/05, privacy policy | Pending |
| 8 | P0-08 | Add legacy characterization tests for auth, reads, sync preservation, transaction/net-worth/performance behavior | L | H | Approved locked install, P0-06 | Pending |
| 9 | P0-09 | Run approved dependency/license/advisory and static secret scans; triage without leaking metadata/secrets | S | H | Owner disclosure approval | Pending |

## Phase 1 — Foundations

**Objective:** build a runnable TypeScript modular-monolith foundation without changing legacy behavior/data.

**Acceptance:** one locked workspace, three buildable runtimes, strict contracts/config, migrations/test/CI foundation, ARM64 smoke; legacy remains runnable.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 10 | P1-01 | Establish `pnpm` workspace/layout/one lock and preserve legacy start path | M | H | P0-02/08/09 |
| 11 | P1-02 | Strict TS configs, lint/format/import boundaries, unused dependency checks | S | M | P1-01 |
| 12 | P1-03 | Domain exact-decimal/atomic/currency/time/result primitives | M | C | Accounting decisions |
| 13 | P1-04 | TypeBox API/provider schemas and Fastify typed/OpenAPI client generation | M | H | P1-01/03 |
| 14 | P1-05 | Web/API/worker skeletons, health/readiness, no provider import in API | M | H | P1-01/04 |
| 15 | P1-06 | Validated config classification/fail-closed secrets and redaction logger | M | H | Security decisions |
| 16 | P1-07 | Drizzle schema/migration ledger/reviewed SQL process in Testcontainers | M | C | DB tooling approval, P1-03 |
| 17 | P1-08 | Vitest/fast-check/Testcontainers/Playwright/CI foundations and coverage map | M | H | P1-01/05/07 |
| 18 | P1-09 | Reproducible Vite build, bundle report/budgets, remove wrong-runtime dependencies/polyfills | M | M | P1-01/02 |
| 19 | P1-10 | Multi-stage API/worker/web/migrate ARM64 image skeleton and Compose dev stack | M | H | P1-05/07 |

## Phase 2 — Additive schema and import

**Objective:** create account-safe v2 storage and repeatably import legacy evidence beside unchanged legacy tables.

**Acceptance:** full schema/RLS/immutability constraints pass; import reruns identically; all legacy rows map or quarantine; legacy checksums unchanged.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 20 | P2-01 | Accounts/users/memberships/sessions/wallets/chains schema and forced RLS | L | C | P1-07, ownership decisions |
| 21 | P2-02 | Asset identity/metadata/provider mapping/reviewed asset groups | L | C | P2-01, grouping decisions |
| 22 | P2-03 | Provider connections, envelope encryption metadata, jobs/runs/checkpoints/outbox | L | C | P2-01, key custody decisions |
| 23 | P2-04 | Immutable observations/normalization/audit schema and update/delete-deny triggers | M | C | P2-01/03, retention decision |
| 24 | P2-05 | Events/ledger/postings/lots/prices/balances/positions/reconciliation/snapshots schema | XL | C | P1-03, P2-01/02/04 |
| 25 | P2-06 | Read-only legacy inventory/import repositories with content manifest | M | H | P0-07, P2-01–05 |
| 26 | P2-07 | Import accounts/wallets/chains/assets; quarantine unresolved identity | L | C | P2-06, owner mappings |
| 27 | P2-08 | Import current balances/protocols/transactions/snapshots as legacy evidence | L | C | P2-07 |
| 28 | P2-09 | Import exclusions/static/hardcoded exceptions as proposed audited adjustments | M | C | P2-08, manual policy |
| 29 | P2-10 | Migration/import performance, idempotency, checksum and two-tenant test suite | L | C | P2-06–09 |

## Phase 3 — Immutable providers and worker

**Objective:** create durable, cost-aware, replayable provider ingestion in shadow mode.

**Acceptance:** common adapter suite passes; runs/checkpoints/costs complete; failed/partial cannot erase state; no secrets in artifacts; schedules remain disabled until approved.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 30 | P3-01 | Durable queue leases, cancellation, retry/jitter, locks, outbox, metrics | L | C | P2-03, P1-06/08 |
| 31 | P3-02 | Adapter SDK/redacting HTTP/schema/page/checkpoint/cost/fixture harness | L | C | P2-04, P3-01 |
| 32 | P3-03 | DeBank adapter, durable caches, credit attribution and parity fixtures | L | C | P3-02, budget/source decisions |
| 33 | P3-04 | EVM/Solana/Cosmos/Sui/Aptos/Hyperliquid adapters in approved value/risk order | XL | C | P3-02/03, identity mappings |
| 34 | P3-05 | Binance/Kraken/Coinbase/manual/Gnosis/Rubic adapters with full pagination | XL | C | P3-02, connection decisions |
| 35 | P3-06 | Generic Blockscout/Robinhood Chain adapter only if retained; no special chart/accounting path | M | H | P3-02, scope decision |
| 36 | P3-07 | Price/FX adapters, unique asset/time batching and immutable buckets | L | C | P3-02, price policy |
| 37 | P3-08 | Shadow schedule/budget/freshness policy and Data Health run queries | M | H | P3-03–07, Pi/budget decisions |

## Phase 4 — Domain projections and accounting

**Objective:** derive deterministic events, ledger, lots, prices, balances, valuations, explanations, and reconciliation.

**Acceptance:** complete fixture/property/integration suites; unknown propagates; internal transfers/bridges neutral; incomplete basis suppresses P&L; worker-only snapshots reproduce.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 38 | P4-01 | Normalizers/source-key/correction/version framework | L | C | P3 adapters, P2-05 |
| 39 | P4-02 | Transfer/trade/fee/reward/income canonical event linking | XL | C | P4-01, classification decisions |
| 40 | P4-03 | Internal transfer/bridge/cross-chain matching and review confidence | L | C | P4-02, asset groups |
| 41 | P4-04 | Classification rules, preview, one-time adjustments/reversals/audit | L | C | P4-02/03, manual policy |
| 42 | P4-05 | Balanced postings and reconciliation engine | L | C | P4-02–04 |
| 43 | P4-06 | FIFO lots/fees/missing basis and future method interface | XL | C | P4-05, basis decisions |
| 44 | P4-07 | Price resolver/freshness/confidence/historical/FX policy | L | C | P3-07, price decisions |
| 45 | P4-08 | Balance/protocol projection versions and atomic promotion | L | C | P4-01/05 |
| 46 | P4-09 | Net worth/cash flow/result/P&L/TWR/XIRR read models and explanations | XL | C | P4-05–08, metric decisions |
| 47 | P4-10 | Full replay/idempotency/property/reconciliation/performance suite | L | C | P4-01–09 |

## Phase 5 — Reconciliation and owner sign-off

**Objective:** explain old/new differences and clear material unknowns before reliance.

**Acceptance:** every wallet/statistic compared; no material unresolved difference; accepted differences have reason/evidence/approval.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 48 | P5-01 | Old-vs-new comparison data model/report with source/formula cuts | L | C | P4 complete, P0 inventory |
| 49 | P5-02 | Asset mapping/quarantine and duplicate/source completeness resolution | L–XL | C | P5-01; data-dependent |
| 50 | P5-03 | Classification/basis/price/reconciliation review queues and evidence | L–XL | C | P5-01; data-dependent |
| 51 | P5-04 | Owner review/sign-off and accepted-difference manifest | M | C | P5-02/03 |

## Phase 6 — Read API and product UX

**Objective:** ship the five-area responsive/accessibility-tested UI using real accepted v2 data.

**Acceptance:** typed/security/browser/accessibility/bundle tests pass; every value explains itself; no placeholder/fake data; no Robinhood-specific chart.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 52 | P6-01 | SIWE, server sessions, roles, CSRF, headers/rate limits, security tests | L | C | P2-01, auth decisions |
| 53 | P6-02 | Typed read API/pagination/filtering/calculation explanation endpoints | L | H | P4-09, P1-04 |
| 54 | P6-03 | UI tokens/shell/navigation/query/error/freshness/accessibility primitives | L | H | P1-09, UX plan |
| 55 | P6-04 | Overview | M | H | P6-02/03, P5 sign-off |
| 56 | P6-05 | Holdings with reviewed aggregation and detail expansion | L | H | P6-02/03, P5 sign-off |
| 57 | P6-06 | Activity, needs-review, source/audit and adjustment/rule flows | L | C | P4-04, P6-01–03 |
| 58 | P6-07 | Generic Performance with basis completeness and advanced disclosure | L | C | P4-09, P6-02/03 |
| 59 | P6-08 | Data Health sync/reconciliation/cost/retry/job detail | L | H | P3-08, P6-02/03 |
| 60 | P6-09 | Settings: wallets, reporting policy, providers, rules, sessions | L | H | P6-01–03 |
| 61 | P6-10 | Playwright/accessibility/responsive/bundle/security acceptance suite | L | C | P6-04–09 |

## Phase 7 — Pi packaging and parallel run

**Objective:** deploy v2 alongside legacy without cutover, verify recovery, budgets, resources, and parity.

**Acceptance:** owner-approved soak succeeds; restore/rollback rehearsed; no material differences; Pi/provider operational thresholds met.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 62 | P7-01 | Production Pi Compose/Caddy/non-root/read-only/limits/health design implementation | L | C | P1-10, deployment decisions |
| 63 | P7-02 | Encrypted backup/off-device retention/alerts and isolated restore automation | L | C | P0-04, key/destination decisions |
| 64 | P7-03 | Explicit production migrations and shadow deployment runbook rehearsal | M | C | P2 migrations, P7-01/02 |
| 65 | P7-04 | Parallel schedules/comparison/alerts/provider budget and Pi resource soak | Owner-set period | C | P5, P6, P7-03 |
| 66 | P7-05 | Full cutover/rollback rehearsal and approval packet | M | C | P7-04 |

## Phase 8 — Cutover and retention

**Objective:** explicitly switch to v2 with monitored fallback; archive legacy only after retention approval.

**Acceptance:** cutover smoke/monitoring stable; fallback/backup current; owner confirms; no automatic legacy deletion.

| Order | ID | Work item | Effort | Risk | Dependencies |
|---:|---|---|---:|:---:|---|
| 67 | P8-01 | Owner cutover decision and preflight backup/health/comparison check | S | C | P7-05 |
| 68 | P8-02 | Controlled proxy/UI/worker cutover with live monitoring and abort thresholds | S | C | P8-01, explicit authorization |
| 69 | P8-03 | Post-cutover reconciliation/security/provider/resource review | M | C | P8-02 |
| 70 | P8-04 | Define/complete legacy retention; archive after separate approval and restore test | M | C | Owner retention period |

## Unresolved delivery risks

- Legacy live schema/data may differ from checked-in models/SQL.
- Asset references were discarded in legacy tokens and may require provider/on-chain reconstruction or permanent quarantine.
- Historical price/source/cash-flow data may be irrecoverably incomplete; the correct result may remain explicitly incomplete.
- Provider API terms/costs and Pi capacity are not yet measured.
- Owner definitions in the next document block accounting/schema/API decisions.
- Installing/scanning dependencies requires explicit approval to disclose manifest data to registries/scanners.
