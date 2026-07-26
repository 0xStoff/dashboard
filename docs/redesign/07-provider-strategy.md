# Provider strategy and API-call reduction

## Goals

- Correctness and explicit source quality before lower call count.
- One common adapter contract with provider-specific capabilities and limits.
- Immutable, replayable observations; no provider writes projections directly.
- Measurable calls, credits, bytes, latency, freshness, and reconciliation per sync.
- Graceful partial failure that preserves prior valid projections.
- No silent substitution of a cheaper/lower-quality provider.

## Adapter contract

```ts
interface ProviderAdapter {
  readonly provider: ProviderId;
  readonly version: string;
  readonly capabilities: ReadonlySet<Capability>;

  discoverAssets(request: DiscoverAssetsRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  fetchBalances(request: BalanceRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  fetchTransfers(request: TransferRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  fetchTransactions(request: TransactionRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  fetchProtocolPositions(request: PositionRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  fetchPrices(request: PriceRequest, context: AdapterContext): AsyncIterable<ObservationPage>;
  estimateCost(request: AdapterRequest): Promise<CostEstimate>;
  healthCheck(context: AdapterContext): Promise<ProviderHealth>;
}
```

`AdapterContext` supplies a redacting HTTP client, timeout/cancellation signal, retry/rate controller, validated credential handle, run/attempt IDs, sanitized fixture recorder, clock, and logger. It does not expose database projection repositories.

Each page returns:

- Provider request fingerprint, sanitized response, source/effective/received times.
- Page index, previous/next cursor, requested range, terminal/completeness marker.
- Item count and stable source IDs where available.
- Rate-limit headers, estimated/actual credits, bytes, and warnings.
- Schema/parser version.

## Shared execution policy

- Connect/read/total timeouts are configured per provider/capability and bounded by job deadline.
- Retry only classified transient failures, with exponential backoff, full jitter, Retry-After support, and attempt cap.
- Never retry authentication/validation failures automatically.
- Token buckets control calls/credits per provider connection; semaphores control provider and account concurrency.
- Cancellation is cooperative between pages. Accepted pages remain immutable; checkpoints do not advance past the committed page set.
- Payload schemas reject invalid fields/units/types. A response must meet adapter-specific completeness rules before it can replace a current projection.
- Idempotency keys include account, connection, wallet/chain, capability, requested range/cursor, and adapter version. Source-event uniqueness neutralizes duplicate delivery.
- Sanitized recorded fixtures remove headers, secrets, personal labels, and unrelated addresses while preserving schema/edge cases.

## Provider-by-provider plan

| Provider | Target capability | Checkpoint/completeness | Caching/batching | Quality/failure policy |
|---|---|---|---|---|
| DeBank Pro | EVM balances, protocols, metadata where approved | Full-list response validation plus provider counts; run records wallet/endpoint | Dedup identical request; separate balances/protocol/chain/token metadata TTL; wallet activity scheduling | Never use empty/truncated success to clear; no implicit RPC substitution |
| EVM RPC/indexer | Selected verification/transfers only after chain-specific evaluation | Block number/hash and finality depth | Batch JSON-RPC/multicall by chain; shared endpoint limiter | Provider explicitly labeled; reorg-aware; not assumed equivalent to DeBank protocols |
| Solana RPC | Native/SPL/Token-2022 balances/transfers | Slot/commitment, pagination signatures/cursor | Wallet balance requests batched where supported; mint metadata/price cached once | Preserve unknown mints; validate program/account schemas |
| Jupiter/metadata provider | Solana asset mapping/current quote candidate | Response/version/time and mint match | Unique mint batches; long metadata freshness, shorter quote freshness | Metadata never defines identity beyond mint; missing remains unknown |
| Cosmos REST/RPC | Native, IBC/factory denoms, delegation/unbonding/rewards/transfers | Height and pagination key per chain/capability | Denom metadata by chain; endpoint health/fallback | Endpoint switch is explicit in observation; no silently ignored denom classes |
| Sui | All coin types, stakes/locked positions/transfers | Checkpoint/sequence and response cursors | Batch owned-object/coin queries; metadata by coin type | Config list cannot be the inventory authority |
| Aptos | Coin stores/assets, delegated positions/transfers | Ledger version and pagination cursor | Account/resource batching; type metadata cache | Include delegated stake via explicit position facts |
| Hyperliquid | Spot/perp balances, positions, fills/funding as approved | Provider time/cursor/source IDs | Market metadata/contexts once per run; account state per wallet | Stablecoin value requires price policy; no spam-value assumption without recorded rule |
| Binance | Deposits, withdrawals, fiat orders/payments, trades | Provider endpoint cursor/time windows with overlap | Incremental windows; asset metadata cached | Reconcile provider totals/counts; read-only scoped keys |
| Kraken | Ledgers/trades/deposits/withdrawals | Durable offset/time cursor with safe overlap | Batch historical price buckets; never two price calls per event | Preserve original ledger ID/sign; no rolling five-year truncation |
| Coinbase/manual | Account activity or audited import | Provider cursor/file hash/import ID | Incremental/API or content-addressed file | Manual imports use schemas, preview, and audit actor |
| Gnosis Pay | Card transactions/refunds | Full pagination and provider IDs/updated times | Server-stored encrypted connection; incremental cursor | No bearer token in browser; historical FX by transaction time |
| Rubic | Cross-chain trades | All pages/cursor and stable trade IDs | Incremental address windows | No default XMR/zero value; link chain legs and unknown state |
| Blockscout/Robinhood Chain | Generic transfers/trades/balances only if retained | Block/cursor and finality | Incremental pages and shared token metadata | No version-specific Robinhood chart or hardcoded closed contracts; data uses generic ledger/read models |
| Price providers | Current/historical price observations | Asset mapping + time bucket | Unique assets batched per quote/time bucket | Resolver records selected/alternatives/confidence; no silent fallback |
| FX provider | Fiat pairs | Official timestamp/bucket | Batch pair/date ranges | Server-side only; same provenance rules as crypto prices |

Provider availability, licensing, endpoint costs, and redistribution terms must be reviewed before enabling a connector. An adapter may exist but remain disabled if its source quality or terms are not approved.

## DeBank call model

Let:

- `W` = tracked EVM wallets in a manual full refresh.
- `Wa` = wallets whose balance freshness/activity policy actually requires a call.
- `Wp` = wallets whose protocol freshness requires a call.
- `M` = paid metadata calls after unique-asset cache/batching (endpoint-dependent).
- `U` = usage/status calls; measured separately from financial-data calls.

### Current code path

The current forced full EVM refresh makes approximately:

- `W` `/user/all_token_list` calls.
- `W` `/user/all_complex_protocol_list` calls because the force option bypasses the six-hour protocol cache.
- About one cached `/token` call for HYPE metadata per process freshness window.
- Usage/status calls when the refresh dialog opens/finishes.

Current paid financial-data call count is therefore approximately `2W + 1` per forced full refresh, before any provider-specific credit weighting. Call count is not equal to credits; endpoint credit costs must be captured from actual plan/provider metadata.

### Target code path

Target financial-data calls are approximately `Wa + Wp + M`, with chain/token metadata and usage status scheduled independently. Examples are planning scenarios, not promises:

| Scenario | Assumptions | Approximate call reduction vs `2W + 1` |
|---|---|---:|
| Manual refresh, protocols still fresh | `Wa=W`, `Wp=0`, warm metadata | approaches 50% as `W` grows |
| Routine schedule | `Wa=W`, `Wp=0.25W`, warm metadata | about 37.5% for large `W` |
| Half the wallets inactive/not stale | `Wa=0.5W`, `Wp=0.125W`, warm metadata | about 68.75% for large `W` |

These estimates must be replaced by measured endpoint-weighted credits from a two-week baseline. Correctness gates can force higher use; the system must never hide that tradeoff.

## DeBank-specific optimizations

1. Persist request fingerprints/freshness across process restarts; in-memory maps are only a hot cache.
2. Coalesce concurrent requests for the same wallet/endpoint/options into one job/result.
3. Do not force protocol refresh when only balances are requested.
4. Refresh inactive wallets less often only after owner-approved inactivity criteria; a manual force remains available and cost-previewed.
5. Cache chain/token/protocol metadata independently from balance/position observations.
6. Preflight estimated credits and enforce per-run/day/account budgets.
7. Record actual endpoint credits/rate headers when available; otherwise label estimates.
8. Show remaining/consumed credits, cost by endpoint/account, and skipped/delayed jobs in Data Health.
9. Use stale-while-revalidate for reads: serve last accepted projection with visible freshness while a background job runs.
10. Evaluate public RPC/indexers only capability by capability, with parity/reconciliation evidence and explicit source display.

## Price call reduction

- Collect the set of canonical assets once per projection, not once per wallet holding.
- Group requested timestamps into policy buckets (for example minute/current or daily historical, owner-approved).
- Query provider batch endpoints where available and cache immutable bucket results permanently.
- Negative-cache “mapping unavailable” briefly with an explicit reason to avoid repeated misses.
- Build historical price backfills by unique `(asset, quote, bucket)`, not per transaction.
- Keep price-provider call/run/cost records separate from holdings provider costs.

## Data Health contract

For each provider connection show status, last attempt/success, next schedule, stale capabilities/wallets, partial/failed runs, current checkpoint, pending retry, call/credit budget, rate-limit state, source quality, adapter version, and reconciliation. Retry controls enqueue a job and show cost estimate; they do not call the provider from the API request.

## Adapter acceptance criteria

- Sanitized contract fixtures cover success, empty-complete, empty-invalid, pagination, correction, duplication, 429, timeout mid-pagination, cancellation, malformed payload, and partial success.
- A repeated run produces no duplicate canonical events.
- A failed/partial run cannot erase a prior accepted balance/position.
- Checkpoint advances only through committed accepted observations.
- Cost/rate metadata and adapter version appear on every run.
- No secret appears in observation, log, error response, or fixture.
- Provider-vs-projection reconciliation meets documented tolerances.
