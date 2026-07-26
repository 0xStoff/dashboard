# Ledger and accounting specification

## Scope and invariants

This specification defines product accounting, not tax or legal advice. Jurisdiction-specific reporting remains configurable and owner-approved.

Hard invariants:

1. Every canonical event links to source observations or an audited manual adjustment.
2. Original provider signs, units, timestamps, and IDs are preserved.
3. Every ledger event balances to zero per asset across its postings.
4. Internal movement cannot create an external contribution/distribution.
5. Unknown classification, value, price, identity, or basis remains explicitly unknown.
6. Reclassification creates a new event/rule version or reversal; it does not erase history.
7. Authoritative arithmetic uses exact decimals/integers and documented rounding.
8. Metrics are versioned by event cut, classification policy, cost-basis method, valuation policy, currency, and time zone.

## Terms and sign convention

- Ledger posting quantity is signed from the perspective of a ledger account: debit/increase to an asset location is positive; credit/decrease is negative.
- User-facing contributions, distributions, and spending are displayed as positive magnitudes with their category, not overloaded signs.
- External contribution: value entering the tracked portfolio from an untracked owner/external source.
- External distribution: value leaving the tracked portfolio to the owner/external destination and still considered returned capital.
- Spending: portfolio value consumed for goods/services/donations/taxes, distinct from cash returned.
- Internal transfer: same economic asset moves between tracked locations.
- Bridge: linked cross-chain legs representing an internal transformation/movement, excluding fees/slippage.
- Trade: disposal of one asset and acquisition of another.
- Fee: cost charged for an event, including cases where paid in a third asset.
- Reward/income: asset received through protocol/economic activity rather than owner funding.
- Unknown: evidence is insufficient for a safe category.

## Canonical categories

`external_contribution`, `external_distribution`, `spending`, `internal_transfer`, `bridge`, `trade`, `fee`, `reward`, `income`, `manual_adjustment`, `unknown`.

An on-chain transaction can create several ledger events or one compound event with several postings. Transaction hash is not the accounting category.

## Ledger accounts and example postings

Each tracked wallet/CEX/protocol location has an asset subaccount. Counter-accounts represent external funding, distributions, expenses, income, and clearing.

### External contribution of asset A

| Account | Asset | Quantity |
|---|---|---:|
| Tracked wallet | A | `+q` |
| External contribution clearing | A | `-q` |

Contribution reporting value uses the selected event-time price. If price is unavailable, quantity/classification remain valid but contribution value and dependent metrics are incomplete.

### External distribution of asset A

| Account | Asset | Quantity |
|---|---|---:|
| Tracked wallet | A | `-q` |
| External distribution clearing | A | `+q` |

### Internal transfer and network fee

| Account | Asset | Quantity |
|---|---|---:|
| Source tracked wallet | A | `-q` |
| Destination tracked wallet | A | `+q` |
| Source tracked wallet | FEE | `-f` |
| Fee expense clearing | FEE | `+f` |

If one leg arrives later, use an internal-transfer clearing account and retain an unmatched reconciliation warning; never classify the first leg as external solely because the pair is not yet fetched.

### Trade A for B with fee C

| Account | Asset | Quantity |
|---|---|---:|
| Tracked location | A | `-qa` |
| Trade clearing | A | `+qa` |
| Trade clearing | B | `-qb` |
| Tracked location | B | `+qb` |
| Tracked location | C | `-fc` |
| Fee expense clearing | C | `+fc` |

The trade stores source-quoted prices/values separately. Balance conservation does not depend on one reporting-currency value balancing exactly.

### Bridge A on source to B on destination

Use linked source/destination transfer legs and a bridge transformation. If reviewed asset-group rules say A and B represent the same economic asset at ratio 1, funding remains zero. Bridge fees/slippage are separate fee/loss postings. If asset equivalence or the destination leg is unknown, status is `needs_review`; it is not external funding.

### Spending and later reimbursement

The purchase is a `spending` outflow at event-time value. A later reimbursement from outside is an `external_contribution` unless evidence shows it came from another tracked location. The two may be linked for explanation but are not netted out of the source ledger.

## Classification pipeline

1. Normalize provider semantics and direction without assigning economic intent.
2. Identify tracked endpoints at event time.
3. Link transfer/trade/bridge legs using chain IDs, hashes/provider IDs, addresses, assets/groups, quantities, and time windows.
4. Apply deterministic built-in rules.
5. Apply account versioned rules in priority order.
6. Calculate confidence and reason codes.
7. Send ambiguous/low-confidence events to `needs_review` as `unknown`.
8. Apply reviewed manual adjustments/reclassifications as new versions.

Rule evaluation records every candidate/matched rule and the winning reason. A rule must support dry-run impact counts and before/after diffs.

## Required scenario treatment

| Scenario | Canonical treatment | Required evidence / unknown behavior |
|---|---|---|
| Deposit from exchange | Contribution only if source is outside all tracked locations; otherwise internal transfer | Exchange ledger + receiving leg; unmatched stays reviewable |
| Withdrawal to exchange | Internal if destination account is tracked; otherwise distribution or transfer-to-unknown pending intent | Destination ownership/classification |
| Tracked-wallet transfer | Internal transfer + fees | Both addresses tracked at event time; pair legs |
| Cross-chain bridge | Bridge + fee/slippage | Linked source/destination legs and reviewed asset relation |
| Direct cross-chain swap | Trade/bridge compound + fees; no contribution | Source/destination provider/on-chain evidence |
| Card purchase later reimbursed | Spending, then separate contribution/internal reimbursement | Link but do not silently net |
| Cash-funded crypto acquisition | Contribution of acquired asset plus acquisition lot cost from documented cash amount | Cash/payment evidence and event-time conversion |
| Gifted crypto, cash paid externally | Contribution quantity; lot basis depends on owner/jurisdiction evidence | Missing basis stays incomplete; manual evidence may establish basis |
| Sale, proceeds to tracked wallet | Trade then internal transfer | Link proceeds; no distribution |
| Sale, proceeds leave portfolio | Trade plus distribution (or spending if documented) | Destination intent |
| Unknown token, no price | Balance exists; value and dependent totals are partial/unknown | Never zero-value assertion |
| Duplicate provider event | One canonical version; duplicate observation retained/deduped by content/source key | Uniqueness/idempotency evidence |
| Provider correction | New observation/fact/event version supersedes old | Both versions retained |
| Partial sync / page timeout | Accept immutable pages; do not promote incomplete projection unless safe by capability | Run marked partial; prior current state retained |
| Symbol collision | Separate assets by canonical reference | Symbol irrelevant to identity |
| Same asset on networks | Separate assets, optionally grouped by reviewed asset group | No symbol inference |
| Closed with dust | Open if authoritative quantity exceeds defined asset dust policy; owner may adjust with audit | Dust threshold policy and evidence |
| Fee in another asset | Separate C fee posting and lot disposal if required | Event-time C price/basis completeness |
| Protocol reward/locked token | Reward/income event plus locked position location | Avoid double counting position and wallet balance |
| Repeated protocol positions | Distinct provider position IDs/components; aggregate only in read model | Deduplicate by source identity, not display strings |
| XMR conversion vs withdrawal | Trade if converted; distribution/internal transfer only on actual asset movement out | Kraken ledger type/ref IDs and destination evidence |
| Missing historical price | Quantity/event retained; reporting value and dependent P&L incomplete | No current-price substitution |
| Exclusion and restoration | Versioned adjustment/reversal with actor/reason | Original event always visible |

## Valuation policy

### Price record

Every price includes asset, quote currency, timestamp/bucket, exact value, provider, confidence, lookup method, source observation, and method: `observed`, `interpolated`, `carried_forward`, or `manual`.

### Resolution

1. Resolve by canonical asset, never symbol.
2. Select only providers/mappings approved for that asset and use case.
3. Current valuation may reuse a price inside its documented freshness window.
4. Historical valuation uses the event/snapshot time bucket and maximum distance.
5. Interpolation/carry-forward is allowed only by an owner-approved policy; it remains labeled and confidence-reduced.
6. If no acceptable price exists, value is null, not zero. Totals expose priced value plus unpriced asset count and partial status.
7. Stablecoins are not assumed to equal one. A peg/manual policy must create an explicit price record and confidence.
8. FX uses the same records and policy as crypto prices.

No per-wallet price calls: collect unique canonical assets for the projection and batch by provider/time bucket.

## Cost basis and lots

Initial method: FIFO, scoped by account and owner-approved pooling rule (recommended: per asset across tracked locations unless jurisdiction requires wallet-level pools).

- Every acquisition creates a lot with acquisition time, quantity, exact reporting-currency cost, price IDs, fees policy, source event, and basis status.
- Disposals consume oldest eligible remaining lots, then stable tie-break by event/posting ID.
- Quantity conservation: sum original lot quantities − consumptions = remaining quantities.
- Realized P&L = disposal proceeds − consumed assigned cost basis − disposition fees.
- Unrealized P&L = selected current value − remaining assigned cost basis.
- A fee paid in another asset can itself be a disposal and consume that asset's lots.
- Transfers/bridges move lot provenance without realizing P&L unless jurisdiction policy explicitly differs.
- Unknown acquisition basis creates an `incomplete` lot with cause code. Any disposal/current position depending on it shows `incomplete_cost_basis`; realized/unrealized/total P&L are null for the affected scope.
- Average cost or jurisdiction-specific engines may be added behind the same lot-allocation interface and formula version; results are never relabeled across methods.

## Metric definitions

All metrics specify account, period, reporting currency, time zone, event cut, classification version, price policy, and formula version.

### Current net worth

`sum(current liquid asset values) + sum(current net protocol/locked position values)`

Protocol position value includes liabilities as negative components, avoiding a gross-assets-only result. Only one location may own each component at the projection cut. Unpriced components make completeness partial and are listed; they are not included as zeros.

### Net contributions

`external contributions − external distributions`

Spending is separate. Internal transfers, bridges, trades, fees, rewards, and income are not contributions/distributions.

### Cash returned

`external distributions`

Spending may be shown adjacent but not silently merged under this label.

### Total result

Two explicit reporting definitions are proposed; owner must select the default:

- **Investment result:** `ending net worth − opening net worth + external distributions − external contributions`.
- **Owner-economic result:** `ending net worth − opening net worth + external distributions + eligible portfolio-financed spending − external contributions`.

For an all-time view with a documented zero opening portfolio, opening net worth is zero. Spending eligibility is rule-driven. Neither metric is called “performance.”

### Realized and unrealized P&L

- Realized: `proceeds − assigned basis − applicable fees` for disposed lots.
- Unrealized: `current marked value − remaining assigned basis`.
- Results are null/incomplete when required basis or price is absent.

### Return methods

- Absolute result is a currency value, not a return percentage.
- Time-weighted return geometrically links subperiod returns split at external cash flows and requires reliable valuations at boundaries.
- Money-weighted return/XIRR solves dated external cash flows plus terminal value; convergence/multiple-root issues are exposed.
- Advanced return methods remain behind progressive disclosure and are disabled when prerequisite data completeness fails.

## Rounding and time

- Store exact provider atomic quantities and high-precision decimals without presentation rounding.
- Compute with a decimal library configured centrally; never use binary floating point.
- Round only a published output: CHF typically 2 decimal places, token quantities per display policy, tax exports per owner/jurisdiction policy.
- Record the rounding mode (recommended default: half-even for aggregate reporting, subject to owner approval).
- Store timestamps in UTC; report day boundaries in the account timezone. Ambiguous/missing source time zones retain a cause warning.

## Reconciliation

Required checks per accepted run/projection:

- Projected atomic balance vs provider source balance per wallet/location/asset.
- Ledger postings balance to zero per asset/event.
- Balance roll-forward: opening + event postings = closing within exact/tolerance policy.
- Lot quantity vs attributable projected holdings.
- Protocol components vs provider net/gross value, with debt handling.
- Snapshot total vs sum of included valued components.
- Contribution/distribution/spending totals vs classified event set.
- Duplicate source IDs/content and orphan observations/events.

Tolerance is asset/provider-specific and stored with each check. A material unexplained difference prevents successful promotion/cutover.

## Explainability example

Selecting a displayed total opens:

- Formula and version.
- As-of time, reporting currency/time zone.
- Included balance/position/event IDs and source run links.
- Selected price IDs and methods.
- Excluded records and reasons.
- Manual adjustments/rules and actors.
- Completeness/confidence and unresolved reconciliation.

## Acceptance criteria

- The full required scenario fixture matrix has expected canonical events/postings.
- Property tests prove per-asset balance, transfer neutrality, and lot conservation.
- FIFO results are distinguishable from average cost and use historical prices.
- Missing price/basis propagates a typed incomplete result through API/UI.
- Manual classification/value changes are previewable, reversible, and audited.
- The same immutable source cut and rule versions always reproduce the same result.
