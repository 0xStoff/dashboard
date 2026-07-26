# Local Pi snapshot migration report

Status: **local snapshot and evidence-first import verified on 2026-07-26**.

## Scope and safety boundary

- Source: `stoffpi:/mnt/ssd_nvme/apps_deployed/dashboard` via the owner-authorized
  SSH connection to `stoff@stoeff.xyz`.
- The Pi checkout, database, containers, and credentials were not modified. No pull,
  restart, migration, provider call, or deployment occurred on the Pi.
- Destination: git-ignored `local-data/pi-snapshot-20260726/` and the isolated local
  PostgreSQL databases on port `55432`.
- Runtime `.env` files and provider/database credentials were not copied.

## Snapshot artifacts

| Artifact | Purpose | SHA-256 |
|---|---|---|
| `crypto_dashboard.pgdump` | Canonical PostgreSQL 16 custom archive | `ac7a8929cd41b2b993adb323204453aa970f46deec722acd0f642c3de2bcae3e` |
| `crypto_dashboard.pg16.sql` | Plain PostgreSQL 16 compatibility copy used for local restore/import | `1414c99ebeb533384984de79fd5e18165826b7169227505be44fc66f6d3a92bc` |
| `hetzner_db.dump` | Pre-existing legacy archive copied unchanged | `54a2872ffa8869167af7da0fdd0f6ddcc3fb5bf64278854ac73e3f84244728e9` |
| `legacy-build-no-secrets.tar.gz` | Current old build plus generated logos, excluding secrets/dependencies/DB volume | `9a4d55b1c06de027cba8f7a562596dac096647f08fa675b3e9b1ad5a3ee1a543` |

The custom archive was verified using PostgreSQL 16 `pg_restore --list` and contains
111 archive entries. The plain snapshot restored cleanly into the isolated local
PostgreSQL instance. Full artifact metadata is recorded in the ignored local
`manifest.json`.

## Source and import inventory

| Legacy table | Source rows | V2 immutable evidence rows | Result |
|---|---:|---:|---|
| `evm_chains` | 34 | 34 | Exact |
| `net-worths` | 863 | 863 | Exact |
| `non_evm_chains` | 19 | 19 | Exact |
| `protocols` | 38 | 38 | Exact |
| `settings` | 1 | 1 | Exact |
| `tokens` | 376 | 376 | Exact |
| `transactions` | 1,119 | 1,119 | Exact |
| `users` | 13 | 13 | Exact |
| `wallets` | 27 | 27 | Exact |
| `wallets_protocols` | 30 | 30 | Exact |
| `wallets_tokens` | 370 | 370 | Exact |
| **Total** | **2,890** | **2,890** | **Zero missing/mismatched/extra** |

Every evidence row is keyed by the legacy table/key and checked against a SHA-256
of PostgreSQL's source JSON representation. Import batch
`84be432e-6bba-543e-a375-36494b369e28` passed exact reconciliation and an immediate
rerun returned `already_imported`, proving idempotence for this snapshot/config.

## Normalized and quarantined staging

- 27 wallets normalized beneath disabled `legacy-wallet` chain namespaces. This
  preserves ownership/address identity without pretending a generic legacy `evm`
  label is a canonical chain ID.
- 370 balance candidates retain exact normalized quantity, atomic quantity, and
  source USD value.
- 30 opaque protocol-position candidates, 1,119 unclassified transaction candidates,
  and 863 browser-authored USD net-worth snapshots are preserved but not promoted.
- 842 review entries: 376 assets missing contract/mint references, 370 dependent
  balances, 53 non-canonical chain references, 30 opaque positions, 12 unreferenced
  legacy users, and one global setting.

No symbol-only token was merged into a canonical asset. No legacy snapshot was
promoted into authoritative net worth, cost basis, or P&L.

## Local dashboard integration

The loopback-only development API can select the imported account through the
ignored local `.env`; this mode is rejected in production and on non-loopback hosts.
The product UI now reads the presentation structure embedded in the latest imported
net-worth evidence: 42 organized holdings, 11 network allocations, eight live DeFi
protocols, 19 referenced wallets, and 327 daily history points. The 370 balance
candidates remain available as immutable audit evidence rather than being presented
as a flat holdings list. Activity provides searchable, progressively disclosed access
to all 1,119 transaction candidates, and Local data displays import coverage plus the
842-item review queue.

All 398 logo files used by the imported snapshot were copied from the already-created
local source archive into the v2 web bundle. The dashboard does not request logo files
from the Pi at runtime. Snapshot values remain explicitly marked legacy/unverified and
are not promoted into authoritative v2 accounting.

## Pi preservation verification

Before and after the snapshot, the Pi remained on branch `main`, commit `a7803c9`,
with the same 161 pre-existing dirty paths. `dashboard-backend`,
`dashboard-frontend`, and healthy `dashboard-postgres` containers remained running.
All 11 live table counts matched the snapshot inventory after completion.
