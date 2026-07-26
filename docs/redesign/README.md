# Dashboard redesign documentation gate

Status: **audit and architecture complete; local foundation implementation started**

Scope: worktree `/Users/stoff/dev/dashboard-redesign`, branch `codex/dashboard-redesign`.

These documents are the required gate before replacement code is introduced. They are based on the checked-in repository at commit `6f7eadb`. The production checkout, Raspberry Pi, live database, provider accounts, and secrets were not accessed or changed.

## Deliverables

1. [Executive audit](01-executive-audit.md)
2. [Current architecture and data flow](02-current-architecture.md)
3. [Risk register](03-risk-register.md)
4. [Target architecture and immutable pipeline](04-target-architecture.md)
5. [Proposed database schema](05-proposed-database-schema.md)
6. [Ledger and accounting specification](06-ledger-accounting-specification.md)
7. [Provider strategy and API-call reduction](07-provider-strategy.md)
8. [Authentication and threat model](08-authentication-threat-model.md)
9. [UX information architecture and wireframes](09-ux-information-architecture.md)
10. [Pi and future SaaS deployment design](10-deployment-design.md)
11. [Testing strategy](11-testing-strategy.md)
12. [Migration and rollback plan](12-migration-rollback-plan.md)
13. [Ordered backlog](13-ordered-backlog.md)
14. [Decisions requiring owner approval](14-owner-decisions.md)
15. [Implementation status](15-implementation-status.md)
16. [Local Pi snapshot migration report](16-local-pi-snapshot-migration-report.md)

## Gate rules

- Do not change production or the Pi without explicit approval.
- Do not alter, delete, reset, or silently reinterpret legacy data.
- Do not implement a phase until its owner decisions, dependencies, and acceptance criteria are satisfied.
- Keep the legacy application runnable through the parallel-run phase.
- Treat unexplained reconciliation differences as blockers, not rounding noise.
- Use exact decimal or integer-string arithmetic for authoritative amounts; JavaScript `number` is display-only.

## Audit boundaries and limitations

- Git status was clean and the requested branch was active at audit start.
- The repository contains 406 tracked files, including 279 tracked runtime-downloaded/static logos (about 7.1 MB), and about 9,000 lines of application, test, SQL, and documentation source.
- No dependency directories were present. The backend test command therefore produced five passing tests and one module-load failure because `axios` was not installed. This is an environment baseline, not a product pass.
- A live package-advisory lookup was not performed because it would disclose the private dependency manifest to a public registry without separate owner approval. The static dependency/lockfile audit is included; a registry-backed scan is a Phase 1 gate after approval.
- No live database schema, row counts, data samples, provider quotas, production configuration, backups, or Pi resources were inspected. The schema audit is therefore based on model definitions and checked-in SQL. A read-only production inventory and encrypted backup are still required before migration.

## Recommended next action

Review the implemented foundation in [implementation status](15-implementation-status.md). A dependency install/lock and full build remain gated on `AUTH-003`; production, Pi, provider, and migration work remain out of scope without their explicit approvals.
