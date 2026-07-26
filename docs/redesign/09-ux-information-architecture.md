# UX information architecture and wireframes

## Product structure

Five stable routes replace the current icon toggle:

1. **Overview** — current net worth, net contributions, cash returned, total result, allocation, largest positions, freshness/warnings.
2. **Holdings** — asset groups with chain/wallet/protocol breakdown, amount, value, price source, freshness, confidence.
3. **Activity** — unified events, filters, needs-review queue, reclassification/exclusion/adjustment, audit/source links.
4. **Performance** — total result, open/closed positions, defensible realized/unrealized P&L, advanced returns behind disclosure.
5. **Data Health** — providers, syncs, stale/partial data, unpriced assets, unknown events, reconciliation, costs, retries/logs.

Settings contains account/reporting policy, wallets, provider connections, classification rules, sessions/security, and export/retention controls.

Owner decision for this version: there is **no Robinhood-specific chart or dedicated Robinhood performance screen**. If Robinhood Chain data is retained, it appears through generic holdings, activity, and performance models only.

## Global shell

- Desktop: left navigation rail, compact top bar with account, as-of/freshness, reporting currency, sync status, and user menu.
- Mobile: top bar plus bottom navigation for the five areas; filters open in a full-height sheet.
- Route state lives in URLs where appropriate (filters, selected asset/event, review queue), supporting deep links and back/forward.
- Every page has one primary heading, one primary action at most, explicit loading/stale/error/empty states, and no main-page horizontal overflow.

## Overview wireframe

```text
┌ Dashboard ───────────────────── As of 10:42 · 2 warnings · CHF ▾ ┐
│ Overview  Holdings  Activity  Performance  Data Health           │
├───────────────────────────────────────────────────────────────────┤
│ Net worth          Net contributions  Cash returned  Total result │
│ CHF 428,340        CHF 210,000         CHF 38,400     CHF 256,740 │
│ Complete · 10:42   [How calculated]    [How calculated]           │
├──────────────────────────────┬────────────────────────────────────┤
│ Allocation                   │ Largest positions                  │
│ [compact chart + legend]     │ Asset · Value · % · freshness     │
├──────────────────────────────┴────────────────────────────────────┤
│ Warnings                                                          │
│ ! 3 unpriced assets  ! Cosmos stale  ! 2 events need review       │
│ [Review data health] [Review activity]                             │
└───────────────────────────────────────────────────────────────────┘
```

Values shown here are illustrative wireframe labels, never application fixtures or assumed results.

### Overview behavior

- Do not show a metric as complete if any material included scope is unknown.
- Summary cards are compact, aligned, and selectable for explanation—not decorative hero cards.
- Allocation distinguishes liquid holdings and protocol/locked positions without double counting.
- Warning summary is above charts on small screens and always reachable by keyboard.

## Holdings wireframe

```text
┌ Holdings ─ Search assets ─ Account ▾ Chain ▾ Wallet ▾ Status ▾ ┐
│ Asset              Amount      Value       Price      Freshness │
│ ETH                12.45       CHF …       CHF …      4 min     │
│  └ Ethereum / Main wallet      8.00        DeBank     High      │
│  └ Base / Main wallet          2.10        DeBank     High      │
│  └ Protocol: …                 2.35        source …   Medium    │
│ USDC               …           …           …          …         │
│ Unknown asset      …           —           Unpriced   8 min     │
└─────────────────────────────────────────────────────────────────┘
```

- Top rows represent reviewed economic asset groups; expansion preserves canonical network/contract/mint/location detail.
- A same-symbol collision is separate unless explicitly grouped.
- Value `—` plus “Unpriced” is distinct from zero.
- Columns collapse into labeled two-line rows on mobile; no horizontal pan is required for core data.
- Amount, current value, price, source, confidence, and observed time each link to explanation/source detail.

## Activity and needs-review wireframe

```text
┌ Activity ─ All | Needs review (7) ─ Date · Wallet · Chain · Asset ┐
│ 12 Jul  Transfer   ETH  Main → Base wallet    Internal    High     │
│ 11 Jul  Swap       A → B                       Trade       Medium   │
│ 10 Jul  Unknown    USDC → external            Needs review         │
│         [Classify] [Exclude with reason] [View source]              │
└─────────────────────────────────────────────────────────────────────┘

Selected event drawer:
┌ Event detail ──────────────────────────────────────────────────────┐
│ Source facts · linked legs · ledger postings · prices              │
│ Current classification and reason/confidence                       │
│ Rule matches and audit history                                     │
│ [Reclassify once] [Create future rule…] [Reverse adjustment]       │
└─────────────────────────────────────────────────────────────────────┘
```

- Exclusion is not an unlabelled switch. It is a command requiring reason, scope, preview, and audit.
- Creating a future rule shows matched historical/future sample count and financial impact before apply.
- Source data and originals remain visible after adjustments.

## Performance wireframe

```text
┌ Performance ─ Period ▾ Reporting definition ▾ Basis: FIFO          ┐
│ Total result             Realized P&L        Unrealized P&L         │
│ CHF …                    CHF … / Incomplete  CHF … / Incomplete    │
│ [How calculated]         Missing basis: 2 assets                    │
├─────────────────────────────────────────────────────────────────────┤
│ Open positions (primary)                                            │
│ Asset · Value · Remaining basis · Unrealized · Completeness         │
├─────────────────────────────────────────────────────────────────────┤
│ Closed positions (collapsed)                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Advanced returns ▸ TWR · Money-weighted/XIRR · assumptions          │
└─────────────────────────────────────────────────────────────────────┘
```

- “Investment result,” “owner-economic result,” TWR, and XIRR are distinct labels.
- Closed positions never depend on hardcoded asset contracts; dust/manual treatment is visible.
- If basis/price/classification is incomplete, show the affected metric as incomplete and link causes.
- No provider/chain-specific special chart is included in this version.

## Data Health wireframe

```text
┌ Data Health ─ Portfolio freshness: Partial ─ Last good: 10:42       ┐
│ Providers                                                           │
│ DeBank      Healthy  8m   120 credits today / budget …  [Details]   │
│ Cosmos      Partial  2h   2 chains stale                 [Retry…]    │
│ Kraken      Failed   1d   checkpoint …                   [Details]   │
├─────────────────────────────────────────────────────────────────────┤
│ Needs attention                                                     │
│ 3 unpriced assets · 7 unknown events · 1 reconciliation difference │
├─────────────────────────────────────────────────────────────────────┤
│ Sync runs                                                           │
│ Time · provider · wallet/scope · status · counts · cost · duration  │
└─────────────────────────────────────────────────────────────────────┘
```

- Retry opens a scope/cost preview and enqueues a durable job.
- Run detail shows requested range/cursors, pages, counts, credits, rate limits, warnings/errors, checkpoints, adapter version, and reconciliation.
- Stale last-known data remains visible with age/status rather than disappearing.

## Mobile wireframe

```text
┌ Dashboard      Partial · 2 warnings ┐
│ Net worth                         ⓘ │
│ CHF …                               │
│ Contributions … · Result …          │
├──────────────────────────────────────┤
│ Warnings (2)                         │
│ [Unpriced assets] [Stale provider]   │
├──────────────────────────────────────┤
│ Largest positions                   │
│ ETH                  CHF …           │
│   Ethereum · 4m · High              │
└──────────────────────────────────────┘
  Overview Holdings Activity Perf Health
```

The bottom bar labels every icon. Dense tables become stacked rows with explicit labels; details open in a full-screen sheet.

## “How was this calculated?” drawer

Every metric supports a consistent drawer:

```text
Total result · CHF · as of …
Status: Partial (1 unpriced asset excluded)

Formula
Ending net worth + distributions + eligible spending − contributions

Included sources (42)   Excluded (3)   Prices (18)   Adjustments (2)
Data cut / formula version / classification version / timezone

[View underlying activity] [Export calculation evidence]
```

The drawer never claims that exclusions are zero. It distinguishes intentionally excluded, unavailable, not applicable, and unresolved.

## Visual system

- Calm neutral canvas, restrained semantic accent colors, and consistent typography hierarchy.
- Spacing grid and compact density suitable for repeated daily use.
- Border/divider hierarchy instead of nesting every section in a rounded card.
- Tabular numerals; right-aligned numeric columns; currency/unit included in headings or cells.
- Positive/negative/unknown never communicated by color alone; icons/text supplement color.
- Tooltips supplement visible labels but do not contain essential-only information.
- Skeletons preserve layout; stale data remains with a clear badge; errors identify scope and safe retry.

## Accessibility baseline

- WCAG 2.2 AA target.
- Semantic landmarks/headings/navigation/tables; interactive rows are links/buttons, not click-only containers.
- Full keyboard path, visible focus, skip link, 44×44 touch targets where practical.
- Accessible names for icon buttons and stateful controls; live-region announcements for job submission/completion without excessive noise.
- Contrast verified for text, focus, charts, and status; reduced-motion support.
- Charts have summaries/data tables and never carry information unavailable in text.
- Dialog focus trapping/return, form errors associated to fields, and confirmation for consequential actions.

## State matrix

Every data surface explicitly implements:

| State | Behavior |
|---|---|
| Initial loading | Skeleton/label; no zero placeholder |
| Refreshing | Retain last good data; show background progress/freshness |
| Empty complete | Explain genuinely empty scope and next action |
| Empty unknown | Explain missing/failed data; link Data Health |
| Partial | Show accepted data plus affected scope/warnings |
| Stale | Show age and last successful source; allow bounded retry |
| Failed | Keep prior good data if any; scope the error and safe next action |
| Unauthorized | No portfolio data; login/re-auth/account access guidance |

## UX acceptance criteria

- Five routes and deep-linked details work on desktop/mobile.
- Core pages have no horizontal viewport overflow at supported widths.
- Keyboard-only and screen-reader smoke journeys cover login, navigation, filters, explainability, reclassification, and retry.
- Every financial number exposes freshness/completeness and calculation explanation.
- Unknown/unpriced/incomplete states never render as ordinary zero.
- No Robinhood-specific chart or special accounting view is present.
