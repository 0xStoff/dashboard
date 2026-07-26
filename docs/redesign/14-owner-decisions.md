# Decisions requiring owner approval

## Decision process

`Blocking phase` means work before that phase can continue, but the listed phase must not implement or promote behavior until the decision is recorded. Recommended options are defaults for discussion, not silent authorization.

No decision in this document authorizes production/Pi access, deployment, data mutation, credential use, external messaging, dependency-registry disclosure, commit, or push.

## Resolved

### DEC-001 — Robinhood-specific chart scope

- **Decision:** Exclude the Robinhood-specific chart and dedicated Robinhood accounting/performance surface from this version.
- **Approved by:** owner in this task, 2026-07-26.
- **Effect:** The new IA/backlog has only generic Performance. Robinhood Chain data may be retained through the common provider → event → ledger → holdings/activity/performance path, but no hardcoded closed contracts or special chart/formulas are carried forward.
- **Still open:** DEC-019 determines whether generic Robinhood Chain ingestion is included now or deferred.

## Blocking product/accounting decisions

| ID | Decision | Recommended option | Alternatives / impact | Blocking phase |
|---|---|---|---|---|
| DEC-002 | Account/enrollment model | One initial personal account; owner wallet identities are allowlisted/invited, with membership model enabled from day one | Open self-registration increases abuse/support/security scope; one-user-only schema repeats current debt | Phase 2 auth/ownership |
| DEC-003 | Primary reporting currency and timezone | CHF and `Europe/Zurich` for reports; store all source time UTC and allow future account change with new result version | USD default or another zone changes valuation/day boundaries/comparison | Phase 2 account schema; Phase 4 |
| DEC-004 | Default total-result definition | Owner-economic result, clearly labeled, with Investment result alongside; spending eligibility explicit | Investment result default excludes spending from owner-economic recovery view | Phase 4 metrics/UI |
| DEC-005 | Spending vs distribution policy | Keep separate; distributions are returned capital, spending is consumed value; reimbursement is a separate linked event | Combining them simplifies a card but obscures cash returned | Phase 4 classification |
| DEC-006 | Cost-basis method and pooling | FIFO; pooled per canonical asset across tracked locations unless jurisdiction/adviser requires otherwise | Wallet-level FIFO or average cost produces different P&L | Phase 4 lots |
| DEC-007 | Fee treatment | Trade acquisition fees capitalize basis; disposal fees reduce proceeds; network/other fees expense, subject to tax review | Expensing all/capitalizing more changes realized/basis | Phase 4 ledger/lots |
| DEC-008 | Gift/external-cash basis evidence | Missing basis stays incomplete until an audited adjustment with evidence; never assume market price/zero | Deemed market value needs jurisdiction/evidence policy | Phase 4 lots |
| DEC-009 | Period/opening value rules | All-time starts only at demonstrable portfolio inception/zero; other periods include opening value and period flows | Treating first observed balance as contribution/zero can fabricate performance | Phase 4 metrics |
| DEC-010 | Day-close and rounding | UTC source time, report-day in account zone; half-even aggregate rounding, display rounding only | Different day/rounding rules change historical comparisons | Phase 4 valuation |

## Blocking identity/price/provider decisions

| ID | Decision | Recommended option | Alternatives / impact | Blocking phase |
|---|---|---|---|---|
| DEC-011 | Cross-chain economic asset grouping | Canonical chain assets always separate; global/account group only through reviewed mappings/evidence | No grouping is safest but less convenient; symbol auto-group is prohibited | Phase 2 assets; Phase 4 |
| DEC-012 | Price source priority and freshness | Approve per asset class after a measured source/parity report; no universal hardcoded order | A single provider is simpler but increases gaps/manipulation risk | Phase 3 price adapters; Phase 4 |
| DEC-013 | Historical price gaps | No carry/interpolation by default for accounting; optional labeled analysis policy with max gap/confidence | Carry/interpolate improves chart continuity but can fabricate P&L | Phase 4 valuation |
| DEC-014 | Stablecoin policy | Use observed price; optional explicit manual peg price only as labeled low-confidence policy | Assuming 1 silently is prohibited | Phase 4 valuation |
| DEC-015 | DeBank budget/freshness/inactive policy | Measure two weeks, then set endpoint-weighted daily hard budget and wallet/protocol freshness tiers | Manual-only or fixed all-wallet refresh changes cost/staleness | Phase 3 scheduling |
| DEC-016 | Provider source substitution | Require owner-visible opt-in per capability/source after parity evidence | Automatic public RPC fallback risks lower-quality silent data | Phase 3 adapters |
| DEC-017 | Exchange/payment connectors included in v1 | Recommend Binance, Kraken, Gnosis Pay, Rubic and audited manual import only if still actively used; Coinbase scope must be confirmed | Each connector adds credential, pagination, test, support work | Phase 3 adapter order |
| DEC-018 | Hyperliquid scope | Confirm spot only versus spot/perps/funding/fills | Broader scope affects positions, P&L, reconciliation | Phase 3 adapter/schema detail |
| DEC-019 | Generic Robinhood Chain ingestion | Defer unless its holdings/activity are materially needed in this version | Include generic Blockscout adapter but no special chart/accounting | Phase 3 backlog item P3-06 |

## Blocking manual-data and retention decisions

| ID | Decision | Recommended option | Alternatives / impact | Blocking phase |
|---|---|---|---|---|
| DEC-020 | Manual adjustment authority | Editor can propose/apply one-time changes; owner/admin required for broad future rules; all require reason and preview | More permissive roles raise systematic distortion risk | Phase 4 adjustments |
| DEC-021 | Evidence requirements | Optional for low-impact classification, required for basis/value/broad-rule changes over owner-set threshold | Always required adds friction; never required weakens audit | Phase 4 UX/domain |
| DEC-022 | Raw observation retention | Keep DB-hot compressed payloads for a measured period, then encrypted archive; retain hashes/provenance indefinitely | Permanent DB JSON may exceed Pi storage; deletion reduces replay ability | Phase 2/3 storage |
| DEC-023 | Financial/audit/security retention and future deletion | Define separate periods; design per-account key separation/cryptographic erasure before SaaS | Indefinite everything may conflict with privacy/storage | Phase 2 schema; SaaS |
| DEC-024 | Legacy retention after cutover | Recommend at least one owner-approved annual/reporting cycle plus verified archive/restore before removal | Shorter reduces rollback/evidence; indefinite increases maintenance/privacy | Phase 8 only |

## Blocking security/operations decisions

| ID | Decision | Recommended option | Alternatives / impact | Blocking phase |
|---|---|---|---|---|
| DEC-025 | Session expiry/reauth | Short idle with bounded absolute lifetime; recent SIWE for credentials/broad rules/member changes | Longer sessions improve convenience but raise theft window | Phase 6 auth |
| DEC-026 | Provider credential migration and key custody | Re-enter/rotate credentials into encrypted connections; do not copy legacy secrets; keep master key and DB backup separate | Automated copying raises exposure and unknown-scope risk | Phase 2/3 |
| DEC-027 | Pi backup destination/retention/RPO/RTO | Choose encrypted off-device destination and set targets after measured backup/restore | Local-only backup is not acceptable | Before production Phase 2/7 |
| DEC-028 | Operational alert destination | Choose private notification path and on-call owner; alert payloads contain opaque IDs only | No external alerts leaves failures manual | Phase 7 |
| DEC-029 | Pi resource budget/sync windows | Measure hardware/storage; worker concurrency 1 initially; avoid backup/heavy reconciliation overlap | Higher concurrency may improve freshness but risks Pi/DB/provider stability | Phase 7 |
| DEC-030 | Public-service timeline | Keep private/self-hosted until security/isolation/abuse/ops gates pass; SaaS is architecture-ready, not activated | Early public access materially broadens threat/operations scope | Before public exposure |

## Technical choices to approve or delegate

| ID | Decision | Recommended option | Alternative impact | Blocking phase |
|---|---|---|---|---|
| DEC-031 | Workspace/package manager | `pnpm`, one root lock, pinned version | npm/yarn can work; must still be one reproducible workspace | Phase 1 |
| DEC-032 | Database tooling | Drizzle types + checked-in reviewed SQL migrations; no runtime sync | Kysely is acceptable with an explicit SQL migration workflow | Phase 1 |
| DEC-033 | Typed HTTP contract | Fastify + TypeBox request/response schemas + OpenAPI-generated client | Zod/tRPC is possible but must document public-client and validation tradeoffs | Phase 1 |
| DEC-034 | Pi edge/static server | Caddy same-origin TLS/static `/api` proxy | Nginx acceptable with equivalent headers/cert/runbook | Phase 7 |
| DEC-035 | PostgreSQL job queue | In-repo lease table using `SKIP LOCKED`, at-least-once/idempotent | A maintained PG queue library is possible after dependency/ARM64 review | Phase 2/3 |

## Explicit authorizations still required

| ID | Action | Why separate approval is required |
|---|---|---|
| AUTH-001 | Read live Pi/production configuration or database, even read-only | It crosses the stated production/Pi boundary and may expose sensitive operational data |
| AUTH-002 | Create/transfer/test production backups | It handles complete sensitive financial data and off-device storage |
| AUTH-003 | Install dependencies or send manifests to public registry/security services | It discloses project dependency metadata and may run third-party install scripts |
| AUTH-004 | Use real provider credentials or make paid/live provider calls | It exposes/uses secrets, credits, rate limits, and provider data |
| AUTH-005 | Apply any production migration/import/shadow worker/deployment | It mutates production state/resources and can affect provider cost |
| AUTH-006 | Commit, push, open PR, deploy, or cut over | The task explicitly withholds these actions unless asked |

## Minimum decisions before the first implementation phase

Phase 1 can begin after the owner approves or delegates DEC-031–035 and authorizes a safe locked dependency install/scan. Before Phase 2 schema/import design is finalized, DEC-002–003, DEC-011, DEC-020–023, DEC-026, and DEC-027 are required. Before Phase 4 calculations, DEC-004–010 and DEC-012–014 are required. Provider order/schedules require DEC-015–019. Production work always additionally requires the applicable `AUTH-*` authorization.
