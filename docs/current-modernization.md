# Current dashboard modernization

This branch preserves the current dashboard and replaces its internals incrementally.
The production checkout, Raspberry Pi, and legacy tables remain unchanged until an
explicit migration and deployment is approved.

## What is retained

- The current React dashboard, navigation, filters, holdings, protocols, transaction
  tools, and visual language.
- Existing API response shapes while compatibility endpoints are migrated.
- Existing provider coverage and the working Pi deployment.

## What is adopted from the full redesign

- Checked, immutable SQL migrations instead of runtime schema synchronization.
- Canonical chain, wallet, and asset identity. Symbols are display metadata only.
- Exact database precision and string-based authoritative amount boundaries.
- Provider connections, sync runs, immutable raw observations, usage accounting,
  explicit prices, audited adjustments, and audit logs.
- Separate synchronization workers once the first provider adapter is migrated.
- Tenant ownership and row-level isolation before any public multi-user release.
- Data freshness, confidence, provenance, reconciliation, and partial-failure states.

## Compatibility strategy

1. Add `portfolio_core` beside the current tables.
2. Inventory and map legacy users, wallets, chains, and tokens without guessing.
3. Record provider observations and sync results while continuing legacy writes.
4. Build projections and compare them with existing API responses.
5. Move one read endpoint at a time behind a compatibility mapper.
6. Reorganize the current UI only after its data contract is reliable.
7. Cut over production only after live parity and restore tests pass.

## Non-negotiable rules

- A failed or partial sync cannot delete the last valid balance.
- The browser cannot create authoritative portfolio snapshots.
- Unknown classifications and missing prices remain explicitly unknown.
- Manual corrections are database records with a reason, not hardcoded exceptions.
- Internal transfers and bridges cannot be counted as external funding.
- No provider credential or wallet-specific private data enters Git.
- Legacy data is not deleted or reinterpreted during the parallel-run period.

## First implemented foundation

- `backend/db/migrate.js` provides advisory locking, ordered transactions, and SHA-256
  verification so an applied migration cannot be edited silently.
- `001_portfolio_core.sql` adds canonical identities, provider connections, sync runs,
  immutable source observations, high-precision prices, adjustments, and audit logs.
- Production schema synchronization is replaced by validation unless explicitly
  enabled for a disposable legacy development database.
