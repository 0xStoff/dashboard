# Testing strategy

## Purpose

Tests are financial and security controls, not only regression checks. A result is releasable only if the same immutable inputs and versions reproduce it, tenant boundaries hold at the database boundary, and failures cannot erase prior accepted state.

## Current baseline

The legacy backend has three test files. At audit time, with dependency directories absent, `npm test` reported five passing tests and one module-load failure because `axios` was unavailable. The frontend has no test files, integration/database environment, migration suite, provider fixtures, Playwright setup, property tests, tenant tests, or CI workflow. This baseline must be captured after an owner-approved locked install; it is not a passing gate today.

## Test layers

### 1. Domain unit tests

Pure tests in `packages/domain` cover:

- Canonical asset/address normalization.
- Event linking/classification reason codes.
- Balanced posting construction.
- Internal transfer/bridge neutrality.
- Price selection/freshness/confidence.
- FIFO lots, fee handling, missing basis, and rounding.
- Net worth/contribution/distribution/spending/result definitions.
- TWR/XIRR prerequisites and failure states.
- Explanation construction and deterministic versioning.

No network, database, wall clock, random global state, or binary floating-point financial arithmetic is allowed.

### 2. Property-based tests

Use `fast-check` generators constrained to valid exact-decimal/atomic-quantity domains.

Core properties:

- Posting quantities sum to zero per event/asset.
- Applying events from an accepted deterministic order conserves balance; replay is idempotent.
- Internal transfers and bridges do not change account-wide quantity or net contribution, excluding explicit fees.
- Duplicating an observation/job does not change canonical events/projections.
- Lot original quantity equals remaining plus all consumptions; no negative lot quantity.
- FIFO consumes the oldest eligible lot under stable tie-breaking.
- Unknown price/basis/classification cannot become numeric zero/complete through composition.
- Changing symbols/names/logos cannot change canonical identity or calculations.
- Permuting provider page arrival does not change the result once canonical ordering/checkpoints are equal.
- Serialization/deserialization preserves exact decimal strings.

### 3. Provider contract tests

Every adapter runs the same conformance suite using sanitized recorded payloads and synthetic boundary fixtures:

- Complete single/multi-page success and terminal cursor.
- Empty but explicitly complete response.
- Empty/truncated/schema-shifted response that must not clear state.
- Duplicate source event/page and provider correction.
- 429 with Retry-After, transient 5xx, authentication error, timeout mid-page, cancellation.
- Pagination loop/repeated cursor/max page protection.
- Rate-limit/cost metadata capture and secret redaction.
- Checkpoint resume with overlap and idempotency.
- Mapping collision/unknown asset/large atomic amount/unusual decimals.

Fixtures contain no real credential, private label, unnecessary address, or raw signature. A fixture manifest records sanitizer version and content hash.

### 4. PostgreSQL integration tests

Run against the same PostgreSQL major/configuration extensions as deployment via Testcontainers:

- Migrations, constraints, indexes, immutable triggers, decimal mappings.
- Forced RLS for API/worker roles and two-tenant adversarial access.
- Durable job leasing, expiry, cancellation, duplicate delivery, concurrency, and advisory locks.
- Observation insertion, normalization idempotency, projection promotion, and checkpoint atomicity.
- Failed/partial sync preservation of prior current balances.
- Reconciliation and calculation explanation references.
- Rule/adjustment preview/apply/reversal and immutable audit log.
- Deadlock/retry behavior for overlapping account/provider jobs.

Tests must use runtime roles, not a table owner/superuser, except migration-specific setup.

### 5. Migration tests

- Empty database up to latest migration.
- Each supported previous v2 migration version forward to latest.
- Production-like anonymized legacy schema snapshot import; legacy checksum and row counts remain unchanged.
- Re-run import is idempotent.
- Symbol collision/unmapped/quarantined rows remain distinct and accounted for.
- Legacy hardcoded/exclusion corrections import as proposed audited adjustments, not silent result changes.
- Large-table/lock/disk/runtime measurement on a volume comparable to Pi.
- Backup restore followed by migration and verification.
- No destructive down migration is considered rollback; forward repair/restore is rehearsed.

### 6. API tests

Use Fastify injection plus real PostgreSQL for authorization-sensitive paths:

- Request and response schema validation, pagination bounds, decimal string serialization.
- SIWE challenge/login/replay/expiry/domain/URI/chain/address cases.
- Session rotation/revocation/account switch and role matrix.
- CSRF/Origin/Fetch-Metadata checks on every mutation; no state-changing GET.
- Sync enqueue is durable/idempotent and never calls an adapter in the request.
- Read models expose freshness/completeness/calculation IDs.
- Errors are typed/redacted and never contain provider/DB/secret details.

### 7. Browser tests

Playwright against the built web/API/worker/Testcontainers stack:

- Login and logout/revoked-session behavior using a deterministic test signer.
- Overview warning and calculation-explanation flows.
- Holdings asset group expansion, filters, wallet/network/protocol details, unpriced state.
- Activity filters, needs review, one-time reclassification, exclusion/restoration, rule preview, audit history/source link.
- Performance complete/incomplete cost-basis views, open/closed sections, reporting-definition switch.
- Data Health provider/run details, retry enqueue/progress/partial/failed state, credits.
- Wallet/provider settings and role restrictions.
- Refresh does not erase prior values on simulated provider failure.
- Navigation/deep links/back-forward and stale/offline/error behavior.
- Desktop/mobile viewports with no core horizontal overflow.

No Robinhood-specific chart test is required because that surface is excluded from this version. Generic Robinhood Chain fixtures, if retained, use the normal event/ledger suites.

### 8. Accessibility and visual tests

- `axe` automated scans on every main route/state plus manual keyboard/screen-reader smoke checklist.
- Focus order/visibility, dialog focus return, accessible names, live status, semantic table/list controls.
- Contrast and non-color status assertions.
- Deterministic screenshots for key desktop/mobile states; image diffs are review aids, not the sole assertion.
- Reduced-motion and high text zoom/reflow checks.

### 9. Deployment/operations tests

- ARM64 image build/smoke (native runner preferred; emulation as additional signal).
- Non-root/read-only filesystem, dropped capabilities, no source/dev dependencies, no startup install.
- Caddy same-origin routing/TLS/security headers and API cache controls.
- Liveness/readiness and graceful API/worker shutdown with job checkpoint/lease behavior.
- Resource-limit/load test on Pi-equivalent CPU/RAM/storage budget.
- Encrypted backup, checksum transfer, isolated restore, schema/data/RLS/read smoke, and recorded duration.
- Previous compatible image rollback and legacy-route fallback rehearsal.

## Required financial fixture matrix

| Fixture | Primary assertions |
|---|---|
| Exchange deposit | Correct contribution only once; event-time value/provenance |
| Exchange withdrawal | Distribution/internal/unknown depends on tracked destination; signs preserved |
| Tracked-wallet transfer | Account quantity conserved; funding unchanged; fee separate |
| Cross-chain bridge | Linked legs; no double funding; fee/slippage explicit |
| Direct cross-chain swap | Trade/bridge compound; assets/lots correct; no contribution |
| Card purchase later reimbursed | Spending and later contribution/internal event remain separately visible/linked |
| Cash-funded crypto acquisition | Contribution and acquisition lot with evidence/time price |
| Gifted crypto with external cash | Contribution; basis complete only with accepted evidence |
| Sale proceeds to tracked wallet | Realized disposal plus internal transfer; no distribution |
| Sale proceeds leave portfolio | Realized disposal plus distribution/spending/unknown according to evidence |
| Unknown token/no price | Quantity retained; value null; totals partial |
| Duplicate provider event | Same canonical/read result after duplicate ingestion |
| Provider correction | Old/new observations retained; new event version selected |
| Partial sync | Prior current projection retained or only proven-complete scope promoted |
| Timeout halfway through pagination | Accepted pages recorded; checkpoint not advanced past gap; retry converges |
| Symbol collision | Separate assets/prices/balances despite identical symbol |
| Same economic asset across networks | Separate canonical assets; reviewed group aggregation only |
| Closed position with dust | Remains open or adjustment/policy is audited; no contract exception |
| Fee in different asset | Separate disposal/posting and basis treatment |
| Protocol reward and locked token | Reward/position represented once; no wallet/position double count |
| Repeated protocol positions | Source identities dedupe; legitimate positions aggregate only in read model |
| XMR conversion vs withdrawal | Trade is not distribution; actual outflow classified separately |
| Missing historical price | Value/P&L incomplete; current price never substituted |
| Manual exclusion and restoration | Versioned adjustment/reversal, actor/reason, original intact |

Add provider-specific and discovered production characterization fixtures; this table is a minimum.

## Golden files and deterministic replay

For each domain fixture, retain:

- Sanitized raw observation(s) with content hashes.
- Expected normalized facts and canonical events.
- Expected postings/lots/reconciliation.
- Expected portfolio metric values or explicit incomplete causes.
- Adapter/normalizer/classifier/price/formula versions.

Golden changes require a readable semantic diff and reviewer sign-off. Regeneration is never automatic on test failure.

## Old-versus-new comparison testing

Comparison output is keyed by account/wallet/date/asset/metric and includes legacy value, v2 value, exact difference, relative difference, source cuts, and reason code:

- expected precision/rounding difference;
- asset identity split/merge;
- newly discovered/missing provider record;
- classification correction;
- price timestamp/provider policy difference;
- duplicate removal;
- legacy manual exception imported;
- unresolved.

Any material `unresolved` difference fails the Phase 5 gate. Tolerances are owner-approved per metric; they are never a blanket percentage that hides missing records.

## CI gates

Recommended order:

1. Lock/install integrity, formatting, lint, TypeScript project references, dependency-boundary/unused-dependency scan.
2. Domain unit/property tests and contract schema compatibility.
3. Provider fixtures with network disabled.
4. PostgreSQL integration/RLS/job/projection tests.
5. Migration/import tests.
6. Production builds, bundle budgets, SBOM/approved security scan.
7. Playwright/accessibility.
8. Container/Compose/ARM64 and backup/restore scheduled gates.

No test uses live paid providers in ordinary CI. Optional provider smoke tests are explicitly authorized, budgeted, isolated, and never required for deterministic correctness.

## Coverage and release policy

Line percentage alone is not the goal. Release-critical requirements map to named tests. No merge when a critical invariant test is skipped/flaky. Quarantining a security/accounting/migration test requires owner-visible risk acceptance and expiry.

## Acceptance criteria

- All required fixtures exist and cover source → API/UI outcomes.
- Property tests run enough deterministic seeds and persist failure seeds.
- Tenant isolation is tested at database, repository, API, job, and export layers.
- Failure/partial/duplicate/correction runs prove preservation/idempotency.
- Migration leaves legacy checksums/row counts unchanged and reruns safely.
- Browser flows, accessibility, bundle, ARM64, and restore gates pass before cutover.
