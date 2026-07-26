# Executive audit

## Executive conclusion

The current dashboard can remain a private reference system, but it is not a safe accounting system or a safe base for multi-user expansion. Its principal weakness is not visual design; it is the absence of an immutable, tenant-owned financial record. Provider responses are written directly into mutable balance tables, browser-derived totals become portfolio history, asset identity discards contract or mint identifiers, and several tables are global across users.

Migration is blocked until authoritative snapshot writes move server-side, tenant boundaries exist on every owned record, provider ingestion becomes append-only and idempotent, asset identity is collision-safe, accounting rules are specified, and legacy data is backed up and characterized. A staged modular-monolith replacement beside the legacy schema is lower risk than incremental mutation of the existing tables.

## What is worth preserving

- Clear separation of most route, service, model, and provider-oriented files.
- Authentication middleware protects the main `/api` surface.
- Wallet reads and wallet CRUD generally include `user_id` ownership checks.
- Recent sync code makes some useful attempts to preserve rows on explicit Cosmos endpoint failure and Solana metadata failure.
- DeBank has in-process request deduplication and short-lived caching.
- Blockscout pagination is bounded and retries some transient statuses.
- Missing Robinhood prices are exposed as unpriced rather than always treated as zero.
- The application already distinguishes wallet, token, protocol, transaction, and net-worth concepts, giving migration importers concrete legacy sources.

These strengths should be captured with characterization tests; they do not offset the migration blockers below.

## Severity scale

- **Critical**: can materially corrupt financial history, cross tenant boundaries, or make recovery untrustworthy.
- **High**: likely security, accounting, availability, or migration failure with meaningful impact.
- **Medium**: significant correctness, operability, maintainability, cost, or UX weakness.
- **Low**: localized quality issue or documentation debt.

## Findings

### AUD-001 — Browser writes authoritative portfolio history

- **Severity:** Critical
- **Evidence:** The UI derives total net worth by adding browser-fetched token and protocol totals ([useDashboardData.ts:29](../../frontend/src/hooks/useDashboardData.ts#L29)), waits for a settled view, then posts the value and full UI state ([App.tsx:91](../../frontend/src/App.tsx#L91), [useFetchNetWorth.tsx:32](../../frontend/src/hooks/useFetchNetWorth.tsx#L32)). The API accepts the client number and JSON without rebuilding or reconciling it ([netWorth.js:56](../../backend/api/netWorth.js#L56)).
- **User-visible consequence:** Filter races, stale requests, browser FX state, aggregation bugs, or manipulated requests can become permanent chart history.
- **Security/accounting consequence:** An authenticated browser is treated as the accounting authority; snapshots have no account owner, source observations, price provenance, completeness status, or reproducible formula.
- **Recommended correction:** Generate snapshots only in the worker from a completed projection version and valuation set. Store source run IDs, price IDs, formula version, confidence, and reconciliation status. Make the API read-only for snapshots.
- **Blocks migration:** Yes.

### AUD-002 — Global financial tables permit cross-tenant reads and writes

- **Severity:** Critical
- **Evidence:** `transactions`, `net-worth`, and `settings` have no `account_id` or `user_id` ([TransactionsModel.js:4](../../backend/models/TransactionsModel.js#L4), [NetWorthModel.js:5](../../backend/models/NetWorthModel.js#L5), [SettingsModel.js:4](../../backend/models/SettingsModel.js#L4)). Transaction reads return all rows and exclusions update by global primary key ([transactions.js:87](../../backend/api/transactions.js#L87), [transactions.js:111](../../backend/api/transactions.js#L111)); net-worth reads and writes are global ([netWorth.js:7](../../backend/api/netWorth.js#L7)); settings are global ([settingsService.js:6](../../backend/services/settingsService.js#L6)).
- **User-visible consequence:** A future second user could see or change another user's activity, history, and preferences.
- **Security/accounting consequence:** Horizontal privilege escalation and cross-account contamination are inherent in the schema, not merely a missing route check.
- **Recommended correction:** Introduce `accounts`, memberships, account-scoped keys on every owned table, service-level authorization, and PostgreSQL RLS enforced through a transaction-scoped account context.
- **Blocks migration:** Yes.

### AUD-003 — Asset identity is symbol/name based and discards canonical references

- **Severity:** Critical
- **Evidence:** `tokens` stores chain, name, and symbol but no EVM contract, Solana mint, Cosmos denomination, Sui/Aptos type, or provider reference ([TokenModel.js:4](../../backend/models/TokenModel.js#L4)). The bootstrap uniqueness key is `(chain_id, symbol)` ([db_init.sql:31](../../backend/scripts/db_init.sql#L31)); EVM and Solana upserts use the same key even though provider IDs/mints are available ([evm_token_data.js:82](../../backend/token_data/evm_token_data.js#L82), [evm_token_data.js:91](../../backend/token_data/evm_token_data.js#L91), [sol_token_data.js:121](../../backend/token_data/sol_token_data.js#L121), [sol_token_data.js:179](../../backend/token_data/sol_token_data.js#L179)). Read aggregation keys on name plus chain ([tokenService.js:79](../../backend/services/tokenService.js#L79)).
- **User-visible consequence:** Same-symbol or same-name assets can overwrite or merge; balances, logos, and prices can be attributed to the wrong token.
- **Security/accounting consequence:** Provider-poisoned metadata or ordinary symbol collisions can change net worth and P&L, and historical rows cannot be reliably mapped later.
- **Recommended correction:** Use `(chain_id, asset_namespace, normalized_asset_reference)` as the immutable identity and separate mutable metadata/provider mappings. Aggregate across chains only through reviewed asset-group membership.
- **Blocks migration:** Yes.

### AUD-004 — Refresh cleanup can delete valid state after an unvalidated response

- **Severity:** Critical
- **Evidence:** EVM refresh deletes rows absent from the returned token/protocol arrays after no runtime response-schema or completeness check ([evm_token_data.js:16](../../backend/token_data/evm_token_data.js#L16), [evm_token_data.js:39](../../backend/token_data/evm_token_data.js#L39), [evm_token_data.js:132](../../backend/token_data/evm_token_data.js#L132)). Sui/Aptos and Hyperliquid also delete missing rows after mutable upserts ([sui_data.js:48](../../backend/token_data/sui_data.js#L48), [sui_data.js:106](../../backend/token_data/sui_data.js#L106), [hyperliquid_token_data.js:117](../../backend/token_data/hyperliquid_token_data.js#L117)). None of these replace operations is wrapped in one database transaction or conditioned on an explicit complete-page marker.
- **User-visible consequence:** A provider returning an empty, truncated, or schema-shifted success can make holdings disappear; a mid-write failure leaves mixed old/new state.
- **Security/accounting consequence:** Previously valid evidence is destroyed and the resulting valuation is neither a valid old snapshot nor a valid new snapshot.
- **Recommended correction:** Append raw observations first, validate completeness, normalize into a run-scoped staging set, reconcile, and atomically promote a projection only for successful/accepted-partial runs. Never delete prior observations.
- **Blocks migration:** Yes.

### AUD-005 — Manual financial corrections are code mutations, not audited adjustments

- **Severity:** Critical
- **Evidence:** Robinhood contract addresses are hardcoded as confirmed closed positions ([performanceAccounting.js:2](../../backend/services/robinhood/performanceAccounting.js#L2), [performanceAccounting.js:196](../../backend/services/robinhood/performanceAccounting.js#L196)). A checked-in maintenance script hardcodes Cosmos balances, logs full history objects, and overwrites historical snapshots ([update_cosmos_balances.js:4](../../backend/scripts/update_cosmos_balances.js#L4), [update_cosmos_balances.js:61](../../backend/scripts/update_cosmos_balances.js#L61), [update_cosmos_balances.js:75](../../backend/scripts/update_cosmos_balances.js#L75)). Transaction exclusion is a mutable boolean with no actor, reason, before-value, or history ([TransactionsModel.js:51](../../backend/models/TransactionsModel.js#L51), [transactions.js:119](../../backend/api/transactions.js#L119)).
- **User-visible consequence:** Results can change without an explanation, and later code changes can reintroduce or erase exceptions.
- **Security/accounting consequence:** There is no defensible audit trail or reproducible treatment of manual evidence.
- **Recommended correction:** Import known exceptions as `manual_adjustments` and `classification_rules` with original/new values, reason, evidence, actor, time, scope, and reversal links. Remove result-specific source constants only after parity is proven.
- **Blocks migration:** Yes.

### AUD-006 — Authentication is replayable bespoke signing, not SIWE

- **Severity:** High
- **Evidence:** The signed message is only `Authenticate: <nonce>` ([auth.js:40](../../backend/api/auth.js#L40)); it has no domain, URI, chain/account intent, issued-at, expiration, request ID, or SIWE grammar. The nonce is updated when a message is requested but is not rotated after successful login ([auth.js:47](../../backend/api/auth.js#L47), [auth.js:74](../../backend/api/auth.js#L74)).
- **User-visible consequence:** A captured signature remains usable until another challenge is requested.
- **Security/accounting consequence:** Replay and cross-site signing ambiguity can create sessions without a strongly bound user intent.
- **Recommended correction:** Implement EIP-4361 SIWE with domain, URI, chain ID, nonce, issued-at, expiration, and statement; consume nonce atomically on success and rate-limit challenge/login.
- **Blocks migration:** Yes for multi-user/public operation; no for read-only Phase 0 tools.

### AUD-007 — Sessions cannot be revoked and cookie mutations lack CSRF defense

- **Severity:** High
- **Evidence:** A 24-hour JWT is the session, with no server-side session record or rotation ([auth.js:82](../../backend/api/auth.js#L82)); logout only clears the browser cookie ([auth.js:102](../../backend/api/auth.js#L102)). HTTPS cookies use `SameSite=None` for the cross-origin frontend/API arrangement ([auth.js:86](../../backend/api/auth.js#L86)), while mutation routes have no CSRF token or Origin/Fetch-Metadata enforcement. CORS allows credentials ([server.js:35](../../backend/server.js#L35)).
- **User-visible consequence:** Logout cannot invalidate a copied token, and cross-site request protections depend mainly on CORS/browser behavior.
- **Security/accounting consequence:** Stolen sessions remain live and cookie-authorized writes are exposed to CSRF design errors.
- **Recommended correction:** Same-origin `/api`, opaque short-lived server-side sessions stored by hash, rotation/revocation, `Secure`/`HttpOnly`/`SameSite=Lax` cookies, and CSRF plus Origin/Fetch-Metadata checks for every mutation.
- **Blocks migration:** Yes for public service.

### AUD-008 — Tenant enforcement is inconsistent below route level

- **Severity:** High
- **Evidence:** Some sync functions make `userId` optional and remove the filter when absent ([sol_token_data.js:203](../../backend/token_data/sol_token_data.js#L203), [cosmos_token_data.js:122](../../backend/token_data/cosmos_token_data.js#L122), [sui_data.js:109](../../backend/token_data/sui_data.js#L109)). A full refresh calls static sync with no authenticated account context ([wallets.js:178](../../backend/api/wallets.js#L178)); static records carry configuration-supplied wallet/user IDs ([sui_data.js:142](../../backend/token_data/sui_data.js#L142), [sui_data.js:294](../../backend/token_data/sui_data.js#L294)).
- **User-visible consequence:** One user's refresh can modify records unrelated to that user if static sync is enabled or a service is called incorrectly.
- **Security/accounting consequence:** Authorization is a caller convention rather than an invariant.
- **Recommended correction:** Require `AccountContext` at every service/repository boundary, remove optional ownership parameters, validate wallet ownership in the database transaction, and enforce RLS.
- **Blocks migration:** Yes.

### AUD-009 — Runtime ORM synchronization replaces controlled migrations

- **Severity:** High
- **Evidence:** API startup calls `sequelize.sync()` ([server.js:70](../../backend/server.js#L70)); a second script does the same ([sync.js:1](../../backend/sync.js#L1)). The only checked-in SQL is a bootstrap file that already diverges from models—for example its wallet/join tables omit model-required `user_id` columns ([db_init.sql:1](../../backend/scripts/db_init.sql#L1), [WalletModel.js:28](../../backend/models/WalletModel.js#L28), [WalletTokenModel.js:18](../../backend/models/WalletTokenModel.js#L18)).
- **User-visible consequence:** Fresh and long-lived installations can have different schemas and startup failures.
- **Security/accounting consequence:** Schema provenance, upgrade order, rollback/restore testing, constraints, and production review are absent.
- **Recommended correction:** Freeze legacy schema, introspect the live database read-only, and create explicit forward SQL migrations for a separate new schema. Apply migrations as a controlled deployment step, never at runtime startup.
- **Blocks migration:** Yes.

### AUD-010 — Monetary and blockchain arithmetic loses precision

- **Severity:** High
- **Evidence:** Raw quantities are converted through `Number`, exponentiation, multiplication, and floating sums throughout ingestion and reads ([sol_token_data.js:124](../../backend/token_data/sol_token_data.js#L124), [cosmos_token_data.js:65](../../backend/token_data/cosmos_token_data.js#L65), [sui_data.js:190](../../backend/token_data/sui_data.js#L190), [tokenService.js:79](../../backend/services/tokenService.js#L79)). Hyperliquid converts a decimal to `Number`, rounds, then creates a `BigInt` ([hyperliquid_token_data.js:74](../../backend/token_data/hyperliquid_token_data.js#L74), [hyperliquid_token_data.js:106](../../backend/token_data/hyperliquid_token_data.js#L106)). Stored normalized quantities and money are only `DECIMAL(20,8)` and raw amounts `DECIMAL(40,0)` ([WalletTokenModel.js:34](../../backend/models/WalletTokenModel.js#L34)). API responses parse decimals back into float ([netWorth.js:20](../../backend/api/netWorth.js#L20)).
- **User-visible consequence:** Large or highly divisible holdings and small-price assets can round, overflow, or disagree between views.
- **Security/accounting consequence:** Ledger conservation and reproducible valuation cannot be guaranteed.
- **Recommended correction:** Keep atomic quantities as decimal integer strings/`NUMERIC(100,0)`, use decimal libraries at boundaries, store high-precision prices/values, define rounding per currency, and serialize authoritative decimals as strings.
- **Blocks migration:** Yes.

### AUD-011 — Transaction identity is globally collision-prone and corrections overwrite provenance

- **Severity:** High
- **Evidence:** `orderNo` alone is the transaction primary key/unique index ([TransactionsModel.js:7](../../backend/models/TransactionsModel.js#L7)), even though rows come from several providers. All providers upsert on that key and overwrite mutable fields while preserving only the exclusion flag ([transactionService.js:51](../../backend/services/transactionService.js#L51)). Rubic fabricates fallback IDs from timestamp/address and Gnosis uses `createdAt` ([transactionService.js:176](../../backend/services/transactionService.js#L176), [transactionService.js:262](../../backend/services/transactionService.js#L262)).
- **User-visible consequence:** Unrelated provider records can overwrite each other; provider corrections erase the original value.
- **Security/accounting consequence:** Event lineage, idempotency, correction history, and tenant ownership are lost.
- **Recommended correction:** Key observations by account, provider connection, endpoint/event namespace, provider event ID, and content hash. Represent corrections with a new observation and `supersedes_observation_id`; derive canonical events deterministically.
- **Blocks migration:** Yes.

### AUD-012 — Sync runs execute inside HTTP handlers without durability or concurrency control

- **Severity:** High
- **Evidence:** Wallet refresh handlers directly await all provider work ([wallets.js:178](../../backend/api/wallets.js#L178)); transaction GET/POST handlers likewise fetch and write provider data before responding ([transactions.js:14](../../backend/api/transactions.js#L14), [transactions.js:72](../../backend/api/transactions.js#L72)). There is no job/run model, lease, checkpoint, cancellation record, or account/provider lock.
- **User-visible consequence:** Requests can time out while work continues, duplicate clicks race, and progress/freshness is unknowable after a restart.
- **Security/accounting consequence:** At-least-once execution is unmanaged; overlapping mutations can create partial or stale projections and expensive abuse.
- **Recommended correction:** API only enqueues a unique account/provider/range job. A separate worker leases it, records `sync_runs` and checkpoints, applies provider budgets, and publishes projections atomically.
- **Blocks migration:** Yes.

### AUD-013 — Provider pagination and completeness are inconsistent

- **Severity:** High
- **Evidence:** Rubic fetches only page 1 with a fixed 100 rows ([transactionService.js:225](../../backend/services/transactionService.js#L225)); Gnosis reads one `results` array with no next-page loop ([transactionService.js:158](../../backend/services/transactionService.js#L158)); Binance calls a full 2020-to-now range without an explicit page/cursor loop ([transactionService.js:15](../../backend/services/transactionService.js#L15), [transactionService.js:66](../../backend/services/transactionService.js#L66)). Kraken loops offsets but has no persisted checkpoint, timeout, retry, or stable end cursor ([utils.js:89](../../backend/utils/utils.js#L89)). Blockscout pagination is bounded but restarts from page one on every refresh ([blockscoutClient.js:21](../../backend/services/robinhood/blockscoutClient.js#L21)).
- **User-visible consequence:** Deposits or activity beyond provider defaults can be missing, while every refresh repeats old work.
- **Security/accounting consequence:** Funding, withdrawals, cost basis, and P&L can be materially incomplete without a completeness warning.
- **Recommended correction:** Provider-specific cursor contracts, recorded requested/returned ranges, terminal-page assertions, checkpoints advanced only after commit, and reconciliation against provider counts/balances.
- **Blocks migration:** Yes for affected metrics.

### AUD-014 — Unknown prices and metadata are silently converted to zero or guessed

- **Severity:** High
- **Evidence:** Solana price fallbacks end in zero ([sol_token_data.js:102](../../backend/token_data/sol_token_data.js#L102), [sol_token_data.js:141](../../backend/token_data/sol_token_data.js#L141)); static data and Sui token records do the same ([sui_data.js:36](../../backend/token_data/sui_data.js#L36), [sui_data.js:294](../../backend/token_data/sui_data.js#L294)); Hyperliquid assumes token index 0 has price 1 ([hyperliquid_token_data.js:23](../../backend/token_data/hyperliquid_token_data.js#L23)); Rubic falls through missing CHF values and even asset identity to zero/`XMR` ([transactionService.js:253](../../backend/services/transactionService.js#L253), [transactionService.js:262](../../backend/services/transactionService.js#L262)).
- **User-visible consequence:** An unknown holding can appear worthless; missing transaction value can look like a real zero; an unidentified Rubic asset can look like XMR.
- **Security/accounting consequence:** Completeness errors become false financial facts and can bias net worth, funding, withdrawals, and P&L.
- **Recommended correction:** Model `unknown` explicitly, keep nullable prices/values with cause codes, require an identified canonical asset before valuation, and show incomplete metrics instead of substituting zero.
- **Blocks migration:** Yes.

### AUD-015 — Price records have no historical provenance or resolution policy

- **Severity:** High
- **Evidence:** Current prices live as mutable columns on `tokens` ([TokenModel.js:26](../../backend/models/TokenModel.js#L26)); no provider, timestamp, quote currency, confidence, method, or source observation is stored. The browser fetches live FX independently ([useUsdToChfRate.tsx:10](../../frontend/src/hooks/useUsdToChfRate.tsx#L10)). Historical XMR uses daily close queries and a separate mutation script, not shared price records ([backfill_xmr_chf.js:8](../../backend/scripts/backfill_xmr_chf.js#L8)).
- **User-visible consequence:** The same event can display different CHF/USD values later, with no explanation of which price was used.
- **Security/accounting consequence:** Historical valuation is not reproducible and provider manipulation/outliers cannot be audited.
- **Recommended correction:** Store immutable timestamped price observations and selected prices with provider, method, confidence, freshness, lookup bucket, and policy version; resolve FX server-side through the same mechanism.
- **Blocks migration:** Yes.

### AUD-016 — Robinhood “FIFO” and P&L are not defensible accounting

- **Severity:** High
- **Evidence:** The function named `allocateFifo` allocates sale proceeds to later purchases ([performanceAccounting.js:80](../../backend/services/robinhood/performanceAccounting.js#L80)), while cost basis is actually removed using average inventory cost ([performanceAccounting.js:157](../../backend/services/robinhood/performanceAccounting.js#L157)). Purchase USD values and all P&L are converted using the account's current ETH/USD rate ([performanceAccounting.js:218](../../backend/services/robinhood/performanceAccounting.js#L218), [performanceAccounting.js:336](../../backend/services/robinhood/performanceAccounting.js#L336), [performanceAccounting.js:398](../../backend/services/robinhood/performanceAccounting.js#L398)). Missing inventory basis becomes zero cost rather than an incomplete-basis result ([performanceAccounting.js:157](../../backend/services/robinhood/performanceAccounting.js#L157)).
- **User-visible consequence:** Realized/unrealized P&L and returns can be materially wrong while appearing precise.
- **Security/accounting consequence:** Labels misstate the method, historical FX is fabricated from current rates, and basis gaps inflate gains.
- **Recommended correction:** Implement explicit acquisition lots and deterministic FIFO consumption using event-time prices; propagate missing basis as `incomplete_cost_basis` and make affected P&L null.
- **Blocks migration:** Yes for Performance.

### AUD-017 — Cash-flow classification is browser-only and sign semantics are lossy

- **Severity:** High
- **Evidence:** The browser classifies deposits/withdrawals from provider strings and uses `Math.abs(Number(...))` ([transaction-calculations.ts:30](../../frontend/src/utils/transaction-calculations.ts#L30), [transaction-calculations.ts:47](../../frontend/src/utils/transaction-calculations.ts#L47)). It applies a current EUR/CHF rate when historical value is unavailable ([transaction-calculations.ts:64](../../frontend/src/utils/transaction-calculations.ts#L64)), then computes “net cash returned” as outflows minus deposits ([TransactionCards.tsx:22](../../frontend/src/components/fiat/TransactionCards.tsx#L22)). No backend ledger shares these rules.
- **User-visible consequence:** UI totals can disagree with backend/other views; a provider sign or type change can invert or omit cash flows.
- **Security/accounting consequence:** There is no authoritative, versioned classification or formula provenance.
- **Recommended correction:** Normalize signed source legs server-side, classify canonical events into a balanced ledger, preserve original sign/unit, and expose versioned read models plus calculation explanations.
- **Blocks migration:** Yes.

### AUD-018 — Request/response validation and chain-address validation are ad hoc

- **Severity:** High
- **Evidence:** Wallet creation checks only non-empty strings and update accepts arbitrary partial values ([wallets.js:92](../../backend/api/wallets.js#L92), [wallets.js:120](../../backend/api/wallets.js#L120)); Rubic accepts arbitrary string arrays ([transactionService.js:197](../../backend/services/transactionService.js#L197)); query pagination can be negative/unbounded ([netWorth.js:28](../../backend/api/netWorth.js#L28)). Provider payloads are dereferenced without shared schemas. There are no shared request/response contracts.
- **User-visible consequence:** Invalid addresses and malformed filters fail late or create unusable records; provider schema drift surfaces as 500s or wrong data.
- **Security/accounting consequence:** Expensive endpoints can be abused, invalid account identifiers enter the database, and poisoned provider fields reach calculations.
- **Recommended correction:** Shared TypeBox schemas for all API and provider boundaries; chain-specific normalization/checksums; bounded pagination; structured domain errors; response serialization validation.
- **Blocks migration:** Yes.

### AUD-019 — Provider credentials are global and one credential crosses the browser

- **Severity:** High
- **Evidence:** Binance/Kraken/DeBank/CoinGecko credentials come from global environment variables ([transactionService.js:15](../../backend/services/transactionService.js#L15), [debank_api.js:21](../../backend/utils/debank_api.js#L21)). The user types a Gnosis bearer token into the browser and it is sent in a custom header ([Transactions.tsx:103](../../frontend/src/components/fiat/Transactions.tsx#L103), [useFetchTransactions.tsx:97](../../frontend/src/hooks/useFetchTransactions.tsx#L97)); any authenticated user can trigger the global provider sync routes.
- **User-visible consequence:** Credentials cannot be managed per account, rotated centrally, or safely reused by a future service.
- **Security/accounting consequence:** Browser exposure increases theft surface; global credentials plus global transactions create cross-tenant ingestion and cost abuse.
- **Recommended correction:** Account-owned provider connections, envelope encryption at rest, server-only secret entry/rotation, scoped API keys, redaction, budget/rate controls, and no secret return path.
- **Blocks migration:** Yes for multi-user operation.

### AUD-020 — Production defaults and startup do not fail closed

- **Severity:** High
- **Evidence:** Database credentials have built-in fallback values in Sequelize and Compose ([sequelize.js:3](../../backend/sequelize.js#L3), [docker-compose.yml:5](../../docker-compose.yml#L5)); `JWT_SECRET` and provider requirements are not validated at startup. Public CORS origins and deployment host values also have defaults ([appConfig.js:5](../../backend/config/appConfig.js#L5), [docker-compose.yml:42](../../docker-compose.yml#L42)).
- **User-visible consequence:** A misconfigured deployment may start and then fail unpredictably or run with known credentials.
- **Security/accounting consequence:** Default credential compromise, accidental exposure, and unverifiable environment drift.
- **Recommended correction:** Typed configuration packages with runtime validation; production fails startup on missing secrets, weak keys, default values, or invalid origins. Provide a rotation checklist and secret-file/runtime-secret integration.
- **Blocks migration:** Yes for deployment.

### AUD-021 — Security headers, abuse controls, and safe remote-image ingestion are absent

- **Severity:** High
- **Evidence:** Server middleware configures CORS/body parsing/cookies but no CSP, security headers, auth/sync rate limits, request IDs, or CSRF middleware ([server.js:28](../../backend/server.js#L28)). Provider-supplied HTTPS logo URLs are fetched server-side with redirects/IP destinations unconstrained and only a declared content type checked ([download_logo.js:15](../../backend/utils/download_logo.js#L15)).
- **User-visible consequence:** Expensive sync/login endpoints can be exhausted and malicious image/provider behavior can disrupt the service.
- **Security/accounting consequence:** XSS defense-in-depth is weak, SSRF/redirect and decompression/image risks remain, and provider poisoning has a write path to served assets.
- **Recommended correction:** Restrictive CSP and headers at proxy/API, rate and concurrency limits, CSRF/Origin checks, allowlisted image proxy or offline metadata pipeline, DNS/IP/redirect protections, image decoding/re-encoding, and size/dimension limits.
- **Blocks migration:** Yes for public exposure; high-priority for Pi.

### AUD-022 — Deployment is mutable, non-reproducible, and lacks a worker runtime

- **Severity:** High
- **Evidence:** Compose bind-mounts backend/frontend source and installs packages on every container start ([docker-compose.yml:51](../../docker-compose.yml#L51), [docker-compose.yml:53](../../docker-compose.yml#L53), [docker-compose.yml:81](../../docker-compose.yml#L81), [docker-compose.yml:93](../../docker-compose.yml#L93)). The frontend runs a Webpack dev server, not a static server ([docker-compose.yml:67](../../docker-compose.yml#L67)). The Dockerfile does not copy committed Yarn locks, backend install is unlocked, and the frontend build writes `dist` while its package script copies/deletes `build` ([Dockerfile:2](../../Dockerfile#L2), [frontend/webpack.config.js:11](../../frontend/webpack.config.js#L11), [frontend/package.json:65](../../frontend/package.json#L65)). There is no worker service.
- **User-visible consequence:** Restarts depend on registry availability and may install different packages; build/runtime behavior differs; long syncs compete with API requests.
- **Security/accounting consequence:** Supply-chain drift, writable source/container surfaces, and no reliable artifact rollback.
- **Recommended correction:** Locked workspace install, multi-stage ARM64 images, static web via Caddy/Nginx, separate API/worker images/processes, non-root/read-only containers, health checks, resource limits, and immutable tagged digests.
- **Blocks migration:** Yes for cutover.

### AUD-023 — Backups and restore verification are not defined

- **Severity:** High
- **Evidence:** Compose defines only a local PostgreSQL volume ([docker-compose.yml:100](../../docker-compose.yml#L100)); deployment notes contain pull/build/restart instructions but no backup, encryption, off-device copy, retention, integrity check, or restore drill ([deployment.md:11](../deployment.md#L11)).
- **User-visible consequence:** Pi/storage failure can erase portfolio history and manual work.
- **Security/accounting consequence:** Recovery point/time are unknown; local backup theft is unmitigated; migration cannot be safely reversed.
- **Recommended correction:** Encrypted off-device physical backups plus WAL/logical strategy as appropriate, checksums, retention, monitored completion, quarterly isolated restore test, and pre-migration/cutover restore points.
- **Blocks migration:** Yes.

### AUD-024 — Paid DeBank use is only partially optimized and not attributable

- **Severity:** Medium
- **Evidence:** The helper deduplicates identical in-flight calls and caches responses in memory ([debank_api.js:3](../../backend/utils/debank_api.js#L3)), but a forced EVM refresh bypasses both token and six-hour protocol freshness per wallet ([evm_token_data.js:72](../../backend/token_data/evm_token_data.js#L72), [evm_token_data.js:123](../../backend/token_data/evm_token_data.js#L123), [evm_token_data.js:146](../../backend/token_data/evm_token_data.js#L146)). Usage UI shows provider account aggregates and a browser-local last-updated time, not credits per sync/account/endpoint ([TokenDataUpdater.tsx:33](../../frontend/src/components/header/TokenDataUpdater.tsx#L33), [TokenDataUpdater.tsx:119](../../frontend/src/components/header/TokenDataUpdater.tsx#L119)).
- **User-visible consequence:** Refresh cost and actual data freshness are unclear; inactive wallets cost the same as active ones.
- **Security/accounting consequence:** Provider budgets cannot be enforced or audited, and cache state is lost on restart.
- **Recommended correction:** Durable endpoint/wallet freshness, conditional jobs, metadata caches separated from balances, per-run estimated/actual credits, quotas, inactivity policy, and Data Health reporting.
- **Blocks migration:** No, but blocks provider rollout at scale.

### AUD-025 — Retries, timeouts, cancellation, and idempotency are uneven

- **Severity:** Medium
- **Evidence:** DeBank has no explicit timeout/retry ([debank_api.js:19](../../backend/utils/debank_api.js#L19)); Binance/Kraken requests lack consistent timeouts/retries ([utils.js:10](../../backend/utils/utils.js#L10), [utils.js:103](../../backend/utils/utils.js#L103)); Cosmos has endpoint fallback but no jitter/backoff ([cosmos_token_data.js:27](../../backend/token_data/cosmos_token_data.js#L27)); Blockscout retries only 429/5xx with deterministic short waits ([blockscoutClient.js:6](../../backend/services/robinhood/blockscoutClient.js#L6)). No adapter supports cancellation or records rate-limit headers.
- **User-visible consequence:** Slow providers hold requests open and transient failures produce inconsistent outcomes.
- **Security/accounting consequence:** Retry storms, duplicate work, unknown partial progress, and provider bans/cost overruns.
- **Recommended correction:** Common adapter runtime with timeout budget, exponential backoff plus jitter, Retry-After support, cancellation signal, pagination checkpoint, idempotency key, and persisted attempt metadata.
- **Blocks migration:** Yes for provider adapter acceptance.

### AUD-026 — Current balances and protocols have no observation time or reconciliation status

- **Severity:** Medium
- **Evidence:** Join rows store only mutable amounts/values and disable timestamps ([WalletTokenModel.js:34](../../backend/models/WalletTokenModel.js#L34)); protocol payloads are mutable JSON with timestamps disabled ([WalletProtocolModel.js:34](../../backend/models/WalletProtocolModel.js#L34)). Read models expose amounts/prices but not provider, source, observed-at, confidence, or stale status ([tokenService.js:10](../../backend/services/tokenService.js#L10), [protocolService.js:177](../../backend/services/protocolService.js#L177)).
- **User-visible consequence:** A stale balance looks identical to a fresh one, and users cannot tell whether a partial provider failed.
- **Security/accounting consequence:** Reconciliation and snapshot completeness cannot be proven.
- **Recommended correction:** Projection rows reference observation/run versions and carry `observed_at`, `projected_at`, source/provider, freshness state, confidence, and reconciliation link.
- **Blocks migration:** Yes.

### AUD-027 — Dependency boundaries and lockfiles are inconsistent

- **Severity:** Medium
- **Evidence:** Three Yarn locks plus a backend npm lock coexist, while install commands mix Yarn and npm registry configuration ([package.json:3](../../package.json#L3), [backend/package.json:1](../../backend/package.json#L1), [frontend/package.json:1](../../frontend/package.json#L1), [docker-compose.yml:53](../../docker-compose.yml#L53)). Frontend production dependencies include server/runtime packages such as Express and Sequelize and many unused wallet/chain SDKs ([frontend/package.json:5](../../frontend/package.json#L5)); the current source imports `date-fns` although it is only transitive, not declared ([TokenDataUpdater.tsx:2](../../frontend/src/components/header/TokenDataUpdater.tsx#L2)). Backend direct dependencies include multiple unused HTTP/runtime/SDK packages ([backend/package.json:11](../../backend/package.json#L11)).
- **User-visible consequence:** Installs/builds are slow and fragile; transitive changes can break source imports.
- **Security/accounting consequence:** Unnecessary supply-chain and browser bundle attack surface; reproducibility is unclear.
- **Recommended correction:** One pinned package manager/workspace lock, dependency-cruiser/knip checks, runtime-specific packages, explicit direct dependencies, and registry-backed vulnerability/license scan after owner approval.
- **Blocks migration:** No; Phase 1 gate.

### AUD-028 — Frontend bundle is split but not measured or deliberately bounded

- **Severity:** Medium
- **Evidence:** Webpack creates React, MUI, charts, and general vendor chunks with unusually high warning thresholds (1.5 MB asset/2 MB entry) ([webpack.config.js:61](../../frontend/webpack.config.js#L61), [webpack.config.js:89](../../frontend/webpack.config.js#L89)). Node polyfills are configured for browser code ([webpack.config.js:17](../../frontend/webpack.config.js#L17)); the dependency set contains two Sui SDK generations and broad chain/server packages ([frontend/package.json:5](../../frontend/package.json#L5)). No checked-in bundle report/budget exists, and the build script's path mismatch prevents a reliable clean baseline.
- **User-visible consequence:** Initial load can be slow on mobile/remote Pi connections.
- **Security/accounting consequence:** Larger client surface and accidental bundling of server-oriented code/configuration.
- **Recommended correction:** Vite build with route-level lazy loading, remove SDKs not used for SIWE, explicit bundle budget/report in CI, and no Node polyfills unless a reviewed dependency requires them.
- **Blocks migration:** No.

### AUD-029 — UI calculations duplicate backend data and hide stale/error states

- **Severity:** Medium
- **Evidence:** Holdings totals are recalculated from `amount * price` in the browser ([WalletTable.tsx:79](../../frontend/src/components/crypto/WalletTable.tsx#L79)); net worth is separately composed in a hook ([useDashboardData.ts:29](../../frontend/src/hooks/useDashboardData.ts#L29)); transaction totals are entirely client-side. The generic hook keeps prior data on error and only logs the failure ([useApiResource.ts:29](../../frontend/src/hooks/useApiResource.ts#L29), [useApiResource.ts:43](../../frontend/src/hooks/useApiResource.ts#L43)); the dashboard does not surface resource errors ([App.tsx:46](../../frontend/src/App.tsx#L46)).
- **User-visible consequence:** Different screens can disagree, and stale results can remain visible without a warning.
- **Security/accounting consequence:** Browser arithmetic becomes an unversioned financial rule and partial failures are not explicit.
- **Recommended correction:** Serve authoritative read models with decimal strings, formula metadata, freshness/warnings, and calculation IDs; browser formats only. TanStack Query should preserve stale data while visibly marking stale/error state.
- **Blocks migration:** Yes for new UI acceptance.

### AUD-030 — Information architecture omits required daily workflows

- **Severity:** Medium
- **Evidence:** Navigation is a boolean toggle between the portfolio and transaction view, represented by unlabeled icons ([NavHeader.tsx:46](../../frontend/src/components/header/NavHeader.tsx#L46), [App.tsx:164](../../frontend/src/App.tsx#L164)). There are no distinct Overview, Holdings, Activity, Performance, or Data Health routes, no needs-review queue, and no calculation-explanation view. Refresh state is local browser storage ([TokenDataUpdater.tsx:33](../../frontend/src/components/header/TokenDataUpdater.tsx#L33)).
- **User-visible consequence:** Important health/review work is hidden, deep links/back navigation are absent, and refresh status can be false on another device.
- **Security/accounting consequence:** Unknown/unpriced/reconciliation issues are not operationally discoverable.
- **Recommended correction:** Implement the five-area IA, durable server freshness, needs-review queue, explainability drawer, route URLs, and progressive disclosure described in the UX plan.
- **Blocks migration:** No for data phases; yes for Phase 6 release.

### AUD-031 — Interactive UI elements are not consistently accessible

- **Severity:** Medium
- **Evidence:** Several header icon buttons have no accessible label ([NavHeader.tsx:50](../../frontend/src/components/header/NavHeader.tsx#L50)); clickable chain rows and protocol cards have pointer handlers but no button/link semantics or keyboard handling ([ChainList.tsx:45](../../frontend/src/components/crypto/ChainList.tsx#L45), [ProtocolTable.tsx:54](../../frontend/src/components/crypto/ProtocolTable.tsx#L54)). Tables/cards deliberately allow horizontal overflow ([WalletTable.tsx:24](../../frontend/src/components/crypto/WalletTable.tsx#L24), [ProtocolTable.tsx:8](../../frontend/src/components/crypto/ProtocolTable.tsx#L8)).
- **User-visible consequence:** Keyboard and assistive-technology users cannot reliably discover or activate core navigation/filters; mobile users must pan tables.
- **Security/accounting consequence:** Users may misread or fail to reach warnings/corrections, and the product does not meet the accessibility acceptance baseline.
- **Recommended correction:** Semantic links/buttons, visible focus, names for every icon, keyboard tests, responsive list/card transformations, contrast/touch targets, announcements for sync state, and WCAG 2.2 AA checks.
- **Blocks migration:** No for data phases; yes for frontend release.

### AUD-032 — Tests do not protect the known failure modes

- **Severity:** High
- **Evidence:** Backend runs only `node --test test/*.test.js` ([backend/package.json:6](../../backend/package.json#L6)) and has three test files. One test explicitly preserves a hardcoded closed-position exception ([robinhoodPerformance.test.js:83](../../backend/test/robinhoodPerformance.test.js#L83)). Frontend declares CRA tests despite using custom Webpack and contains no test files ([frontend/package.json:65](../../frontend/package.json#L65)). There are no checked-in integration, migration, contract, tenant-isolation, property, browser, or reconciliation suites and no CI workflow.
- **User-visible consequence:** Refetch, accounting, auth, filtering, and migration regressions can ship unnoticed.
- **Security/accounting consequence:** No automated proof of ledger conservation, isolation, partial-sync preservation, or restore safety.
- **Recommended correction:** Build the specified fixture matrix first; add Vitest/property tests, sanitized adapter contracts, Testcontainers PostgreSQL, migration snapshot tests, Playwright, tenant-isolation tests, and CI gates.
- **Blocks migration:** Yes.

### AUD-033 — Observability and operational health are insufficient

- **Severity:** Medium
- **Evidence:** Logging uses free-form `console` calls throughout routes/providers, including full error details ([server.js:75](../../backend/server.js#L75), [transactions.js:63](../../backend/api/transactions.js#L63)). Compose has only a PostgreSQL health check ([docker-compose.yml:14](../../docker-compose.yml#L14)); there are no API/worker readiness endpoints, structured run logs, metrics, traces, alert rules, or reconciliation alerts.
- **User-visible consequence:** Failures are discovered through missing data or manual inspection, without clear affected scope.
- **Security/accounting consequence:** Secret/PII redaction is not systematic and partial corruption/cost spikes are not detected promptly.
- **Recommended correction:** Structured JSON with redaction/request/run IDs, OpenTelemetry-compatible traces/metrics, liveness/readiness, sync/reconciliation/provider-budget alerts, and retention controls.
- **Blocks migration:** No for schema work; yes for parallel run/cutover.

### AUD-034 — Wallet and provider input ownership constraints do not fit multi-tenancy

- **Severity:** High
- **Evidence:** Wallet address is globally unique rather than unique within account/chain ([WalletModel.js:11](../../backend/models/WalletModel.js#L11)); the same EVM address is used implicitly for Hyperliquid ([hyperliquid_token_data.js:128](../../backend/token_data/hyperliquid_token_data.js#L128)). Robinhood selection depends on the user-defined tag `MM` ([performanceService.js:8](../../backend/services/robinhood/performanceService.js#L8)).
- **User-visible consequence:** Two accounts cannot track the same public address, and renaming a tag can disable a product feature.
- **Security/accounting consequence:** Public address ownership and provider-purpose identity are conflated; feature configuration is implicit and brittle.
- **Recommended correction:** Account/chain-scoped normalized wallet keys, explicit wallet-provider connection mappings and roles, verified auth addresses separate from tracked addresses, and no behavior keyed to display tags.
- **Blocks migration:** Yes.

### AUD-035 — Historical scripts and Git history show calculations are not characterized

- **Severity:** Medium
- **Evidence:** Recent history contains adding and reverting cash-flow-adjusted history (`50d78ce`, `289909a`) and removing a prior performance implementation (`2a20e90`). Current snapshot history remains mutable JSON ([NetWorthModel.js:19](../../backend/models/NetWorthModel.js#L19)), and the correction script rewrites it in place ([update_cosmos_balances.js:69](../../backend/scripts/update_cosmos_balances.js#L69)).
- **User-visible consequence:** Previously displayed totals may not be reproducible or explainable after code changes.
- **Security/accounting consequence:** Migration cannot assume that legacy columns share one stable definition across time.
- **Recommended correction:** Inventory formula versions by commit/date, preserve raw legacy snapshots unchanged, import them as legacy evidence, and compare new results per date/wallet with explicit difference reasons.
- **Blocks migration:** Yes.

## Migration blocker summary

The following must be resolved before any authoritative v2 result is presented: AUD-001–019, AUD-026, AUD-029, AUD-032, AUD-034, and AUD-035. Deployment cutover additionally requires AUD-020–023 and AUD-033. Cost, bundle, and IA findings can be addressed in their scheduled phases but remain release gates where noted.

## Immediate containment recommendations for the legacy system

These are recommendations only; no implementation or production mutation is authorized yet.

1. Stop treating new browser-created net-worth rows as trusted historical evidence; label them legacy/unverified during import.
2. Do not add another user to the current deployment.
3. Do not run `update_cosmos_balances.js` or other mutation scripts against production without a backup, dry-run report, and explicit approval.
4. Avoid overlapping manual refreshes and record provider failures externally until durable sync runs exist.
5. Take an encrypted, off-device backup and perform an isolated restore before schema work.
6. Keep the legacy service private until session, CSRF, defaults, and rate-limit controls are replaced.
