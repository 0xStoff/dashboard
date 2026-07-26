# Implementation status

Status date: 2026-07-26. This is local source work only. No production checkout,
Raspberry Pi, live database, provider credential, or external provider was accessed.

## Implemented foundation

- Added an isolated pnpm workspace for `apps/*` and `packages/*` while retaining
  the legacy `npm start` path and both legacy lockfile trees.
- Added strict shared TypeScript settings and runtime configuration validation.
- Added exact atomic and decimal string primitives using `bigint`, with tests that
  cover values above `Number.MAX_SAFE_INTEGER`, exact decimal arithmetic, and
  precision-loss rejection.
- Added shared TypeBox contracts for portfolio summaries, calculation explanations,
  sync commands, warnings, and errors. Financial values cross the API as strings or
  explicit `null`, never authoritative JavaScript numbers.
- Added a reviewed additive SQL migration for the `portfolio_v2` schema with
  accounts, sessions, memberships, wallets, assets, provider connections, durable
  jobs, immutable observations, projection versions, snapshots, explanations,
  audit records, row-level security, and append-only triggers.
- Added separate Fastify API and worker runtimes. The API has health and authenticated
  portfolio-summary reads; provider adapters are imported only by the worker.
- Added a provider contract/registry and a tenant-scoped `SKIP LOCKED` lease skeleton.
  Adapter execution is intentionally disabled until adapter security, replay, and
  budget gates pass.
- Added the responsive five-area Vite/React shell with explicit loading, signed-out,
  unavailable, freshness, confidence, and warning states. It contains no mock
  portfolio values and no Robinhood-specific chart.

## Verification completed without network access

- Foundation suite: fourteen passing exact-value, configuration, migration-safety,
  and architecture-boundary tests.
- Package manifests parse as valid JSON.
- `git diff --check` passes.
- Automated boundaries confirm the API cannot import provider adapters, the pure
  domain cannot import frameworks/runtime configuration, no Robinhood-specific
  implementation exists, and the web does not coerce portfolio values to numbers.

## Dependency-backed verification

- The owner authorized registry access on 2026-07-26. A pinned pnpm lockfile was
  generated without touching the legacy frontend/backend lockfiles.
- All nine v2 workspace projects pass strict TypeScript validation.
- All workspace tests pass and the thirteen-test dependency-free foundation suite
  remains green.
- The production web bundle and API/worker JavaScript builds complete successfully.
- The migration applied successfully to an isolated temporary PostgreSQL database;
  API health reports both the service and database reachable.
- The owner-authorized Pi snapshot/import is complete locally: 2,890 legacy rows
  have exact immutable evidence matches, safe normalized candidates, explicit
  quarantine, and an idempotent import manifest. See the dedicated migration report.
- The loopback-only local dashboard now reads that imported account: Overview shows
  the latest legacy snapshot with a permanent unverified warning; Assets and Activity
  expose all imported candidates; Sources exposes coverage and quarantine reasons.

## Deliberately pending

- Automated two-tenant RLS, session lifecycle, queue-concurrency, migration rollback,
  and production-like database integration tests are not implemented yet.
- Sign-in challenge creation, mutations, provider adapters, normalization, ledger,
  valuation, reconciliation, migration/import, production packaging, and deployment
  remain behind their documented phase and owner gates.
- The empty Assets, Activity, Sources, and Settings views are honest capability
  boundaries, not completed product flows. They must consume accepted v2 read models
  before being promoted.
