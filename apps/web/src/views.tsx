import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import type {
  LegacyActivityRow,
  LegacyPortfolioSnapshot,
  LegacySnapshotChain,
  LegacySnapshotHistoryPoint,
  LegacySnapshotProtocol,
  LegacySnapshotToken,
} from "@dashboard/contracts";
import { MetricCard, StatusBadge } from "@dashboard/ui";

import {
  ApiRequestError,
  getLegacyActivity,
  getPortfolio,
  getPortfolioRefreshStatus,
  startPortfolioRefresh,
} from "./api.js";

function usePortfolio() {
  return useQuery({ queryKey: ["portfolio"], queryFn: ({ signal }) => getPortfolio(signal) });
}

export function OverviewPage() {
  const portfolio = usePortfolio();
  return (
    <Page title="Your portfolio" eyebrow="Live multi-chain data" action={<RefreshControl snapshotStatus={portfolio.data?.status} />}>
      {portfolio.isPending ? <LoadingState /> : portfolio.isError ? <ErrorState error={portfolio.error} /> : portfolio.data ? (
        <Overview portfolio={portfolio.data} />
      ) : <PlaceholderPanel text="No live portfolio data is available yet. Refresh all chains to begin." />}
    </Page>
  );
}

function RefreshControl({ snapshotStatus }: { snapshotStatus: LegacyPortfolioSnapshot["status"] | undefined }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["portfolio-refresh"], queryFn: ({ signal }) => getPortfolioRefreshStatus(signal),
    refetchInterval: (query) => ["queued", "running"].includes(query.state.data?.status ?? "") ? 1_500 : false,
  });
  const refresh = useMutation({
    mutationFn: startPortfolioRefresh,
    onSuccess: (value) => { queryClient.setQueryData(["portfolio-refresh"], value); },
  });
  const current = status.data;
  const busy = refresh.isPending || current?.status === "queued" || current?.status === "running";
  const finished = current?.status === "succeeded";
  useEffect(() => { if (finished) void queryClient.invalidateQueries({ queryKey: ["portfolio"] }); }, [finished, queryClient]);
  const message = refresh.error?.message ?? (current?.status === "partial" ? "Some sources failed; previous snapshot kept" : current?.status === "failed" ? `Refresh failed${current.errorCode ? ` · ${current.errorCode}` : ""}` : null);
  return <div className="refresh-control">
    <div className="refresh-control__status">
      <StatusBadge tone={snapshotStatus === "live_refreshed" ? "positive" : "warning"}>{snapshotStatus === "live_refreshed" ? "up to date" : "refresh needed"}</StatusBadge>
      {message ? <small>{message}</small> : current ? <small>{friendlyRefreshStatus(current.status)}</small> : null}
    </div>
    <button className="refresh-button" type="button" disabled={busy} onClick={() => refresh.mutate()}>{busy ? "Refreshing…" : "Refresh all chains"}</button>
  </div>;
}

function friendlyRefreshStatus(status: string) {
  if (status === "succeeded") return "All configured sources reconciled";
  if (status === "queued") return "Waiting for the local worker";
  if (status === "running") return "Fetching and reconciling sources";
  return "Ready for a new refresh";
}

function Overview({ portfolio }: { portfolio: LegacyPortfolioSnapshot }) {
  const topTokens = portfolio.tokens.slice().sort(byUsdValue).slice(0, 6);
  const topChains = portfolio.chains.slice().sort(byChainValue).slice(0, 7);
  const firstPoint = portfolio.history[0];
  const change = firstPoint ? subtractDecimals(portfolio.totalUsdValue, firstPoint.totalUsdValue) : "0";
  const changePositive = !change.startsWith("-");
  const liquidShare = percent(portfolio.totalTokenUsdValue, portfolio.totalUsdValue, 0);
  return (
    <>
      <section className="hero-grid">
        <div className="net-worth-card">
          <p className="eyebrow">Total net worth</p>
          <p className="net-worth-value">{money(portfolio.totalUsdValue, portfolio.currency, 0)}</p>
          <div className="hero-meta">
            <span>{portfolio.tokens.length} assets</span>
            <span>{portfolio.chains.length} networks</span>
            <span>{portfolio.walletCount} wallets</span>
          </div>
          <p className="as-of">Updated {dateTime(portfolio.asOf)}</p>
        </div>
        <div className="allocation-card">
          <div className="allocation-orb" style={{ "--liquid-share": `${liquidShare}%` } as CSSProperties}>
            <span>{liquidShare}%</span><small>liquid</small>
          </div>
          <div><p className="eyebrow">Portfolio mix</p><h2>Tokens + DeFi</h2>
            <p className="muted-copy">{money(portfolio.totalTokenUsdValue, portfolio.currency, 0)} held directly<br />{money(portfolio.totalProtocolUsdValue, portfolio.currency, 0)} in protocols</p>
          </div>
        </div>
      </section>

      <section className="panel chart-panel">
        <div className="panel__header">
          <div><p className="eyebrow">Portfolio history</p><h2>Net worth over time</h2></div>
          <div className={changePositive ? "change positive" : "change negative"}>{changePositive ? "+" : ""}{money(change, portfolio.currency, 0)} since history began</div>
        </div>
        <PortfolioChart history={portfolio.history} currency={portfolio.currency} />
      </section>

      <div className="overview-columns">
        <section className="panel overview-panel">
          <SectionHeader eyebrow="Concentration" title="Largest holdings" link="/assets" />
          <div className="ranked-list">
            {topTokens.map((token, index) => <HoldingRow key={token.key} token={token} total={portfolio.totalUsdValue} rank={index + 1} />)}
          </div>
        </section>
        <section className="panel overview-panel">
          <SectionHeader eyebrow="Allocation" title="Networks" />
          <div className="network-list">
            {topChains.map((chain) => <NetworkRow key={chain.chainId} chain={chain} total={portfolio.totalUsdValue} />)}
          </div>
        </section>
        <section className="panel overview-panel snapshot-panel">
          <SectionHeader eyebrow="Coverage" title="What is included" link="/sources" />
          <dl className="coverage-list">
            <div><dt>History</dt><dd>{portfolio.history.length} daily points</dd></div>
            <div><dt>DeFi</dt><dd>{portfolio.protocols.length} protocols</dd></div>
            <div><dt>Wallets</dt><dd>{portfolio.walletCount} accounts</dd></div>
            <div><dt>Pricing</dt><dd>At snapshot time</dd></div>
          </dl>
          <div className="notice-inline"><span>✓</span><p>Balances and prices are reconciled from the configured providers whenever you refresh.</p></div>
        </section>
      </div>
    </>
  );
}

export function AssetsPage() {
  const portfolio = usePortfolio();
  const [search, setSearch] = useState("");
  const [chain, setChain] = useState("all");
  const groups = useMemo(() => {
    if (!portfolio.data) return [];
    const query = search.trim().toLowerCase();
    const filtered = portfolio.data.tokens.filter((token) =>
      (chain === "all" || token.chainId === chain) &&
      (!query || `${token.symbol} ${token.name} ${token.chainId}`.toLowerCase().includes(query)),
    );
    const map = new Map<string, LegacySnapshotToken[]>();
    for (const token of filtered) map.set(token.chainId, [...(map.get(token.chainId) ?? []), token]);
    return [...map].map(([chainId, tokens]) => ({
      chain: portfolio.data?.chains.find((item) => item.chainId === chainId),
      chainId,
      tokens: tokens.sort(byUsdValue),
      total: portfolio.data?.chains.find((item) => item.chainId === chainId)?.tokenUsdValue ?? "0",
    })).sort((a, b) => compareDecimals(b.total, a.total));
  }, [portfolio.data, search, chain]);
  const largest = portfolio.data?.tokens.slice().sort(byUsdValue)[0];

  return (
    <Page title="Holdings" eyebrow="Organized by network">
      {portfolio.isPending ? <LoadingState /> : portfolio.isError ? <ErrorState error={portfolio.error} /> : !portfolio.data ? <PlaceholderPanel text="No holdings are available." /> : (
        <>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Direct holdings" value={money(portfolio.data.totalTokenUsdValue, portfolio.data.currency, 0)} detail={`${portfolio.data.tokens.length} priced assets`} />
            <MetricCard label="Largest position" value={largest?.symbol ?? "—"} detail={largest ? money(largest.totalUsdValue, portfolio.data.currency, 0) : "No assets"} />
            <MetricCard label="Networks" value={String(portfolio.data.chains.length)} detail={`${portfolio.data.walletCount} wallets`} />
          </div>
          <FilterBar search={search} setSearch={setSearch} placeholder="Search assets or networks">
            <select aria-label="Filter by network" value={chain} onChange={(event) => setChain(event.target.value)}>
              <option value="all">All networks</option>
              {portfolio.data.chains.map((item) => <option key={item.chainId} value={item.chainId}>{item.name}</option>)}
            </select>
          </FilterBar>
          <div className="asset-groups">
            {groups.map((group) => (
              <section className="panel asset-group" key={group.chainId}>
                <div className="asset-group__header">
                  <div className="identity"><Logo src={group.chain?.logoUrl ?? null} label={group.chain?.name ?? group.chainId} size="medium" /><div><h2>{group.chain?.name ?? group.chainId}</h2><p>{group.tokens.length} assets</p></div></div>
                  <strong>{money(group.total, portfolio.data!.currency, 0)}</strong>
                </div>
                <div className="holding-list">{group.tokens.map((token) => <AssetDetailRow key={token.key} token={token} currency={portfolio.data!.currency} />)}</div>
              </section>
            ))}
            {!groups.length && <EmptyResult />}
          </div>
        </>
      )}
    </Page>
  );
}

export function PositionsPage() {
  const portfolio = usePortfolio();
  return (
    <Page title="DeFi positions" eyebrow="Protocols and strategies">
      {portfolio.isPending ? <LoadingState /> : portfolio.isError ? <ErrorState error={portfolio.error} /> : !portfolio.data ? <PlaceholderPanel text="No protocol data is available." /> : (
        <>
          <div className="position-summary"><div><p className="eyebrow">Total in protocols</p><p>{money(portfolio.data.totalProtocolUsdValue, portfolio.data.currency, 0)}</p></div><span>{portfolio.data.protocols.length} active protocols · {portfolio.data.protocols.reduce((sum, item) => sum + item.positions.length, 0)} positions</span></div>
          <div className="protocol-grid">
            {portfolio.data.protocols.slice().sort(byProtocolValue).map((protocol) => <ProtocolCard key={protocol.key} protocol={protocol} currency={portfolio.data!.currency} />)}
          </div>
        </>
      )}
    </Page>
  );
}

export function ActivityPage() {
  const activity = useQuery({ queryKey: ["legacy-activity"], queryFn: ({ signal }) => getLegacyActivity(signal) });
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [visible, setVisible] = useState(80);
  const sources = useMemo(() => [...new Set((activity.data ?? []).map((item) => item.exchange))].sort(), [activity.data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (activity.data ?? []).filter((item) => (source === "all" || item.exchange === source) && (!query || `${item.exchange} ${item.type} ${item.asset} ${item.merchant}`.toLowerCase().includes(query)));
  }, [activity.data, search, source]);
  const groups = useMemo(() => groupActivity(filtered.slice(0, visible)), [filtered, visible]);
  const excluded = activity.data?.filter((item) => item.excludedFromTotals).length ?? 0;
  return (
    <Page title="Activity" eyebrow="Imported transaction history">
      {activity.isPending ? <LoadingState /> : activity.isError ? <ErrorState error={activity.error} /> : (
        <>
          <div className="activity-stats"><div><strong>{integer(activity.data.length)}</strong><span>records</span></div><div><strong>{sources.length}</strong><span>sources</span></div><div><strong>{integer(activity.data.length - excluded)}</strong><span>included</span></div><div><strong>{integer(excluded)}</strong><span>excluded</span></div></div>
          <FilterBar search={search} setSearch={setSearch} placeholder="Search source, asset or merchant">
            <select aria-label="Filter by source" value={source} onChange={(event) => { setSource(event.target.value); setVisible(80); }}><option value="all">All sources</option>{sources.map((item) => <option key={item}>{item}</option>)}</select>
          </FilterBar>
          <div className="timeline">
            {groups.map(([month, items]) => <section key={month}><h2>{month}</h2><div className="panel activity-list">{items.map((item) => <ActivityItem key={item.id} item={item} />)}</div></section>)}
          </div>
          {visible < filtered.length && <button className="load-more" onClick={() => setVisible((value) => value + 80)}>Show 80 more <span>{integer(filtered.length - visible)} remaining</span></button>}
          {!filtered.length && <EmptyResult />}
        </>
      )}
    </Page>
  );
}

export function SourcesPage() {
  const status = useQuery({ queryKey: ["portfolio-refresh"], queryFn: ({ signal }) => getPortfolioRefreshStatus(signal) });
  const portfolio = usePortfolio();
  const sources = refreshSourceRows(status.data?.sources ?? []);
  return (
    <Page title="Data sources" eyebrow="Live provider coverage" action={<StatusBadge tone={status.data?.status === "succeeded" ? "positive" : "warning"}>{status.data?.status ?? "not refreshed"}</StatusBadge>}>
      {status.isPending ? <LoadingState /> : status.isError ? <ErrorState error={status.error} /> : !status.data ? <PlaceholderPanel text="Refresh the portfolio to populate provider status." /> : (
        <>
          <section className="data-hero"><div><p className="eyebrow">Last reconciliation</p><h2>Providers update one atomic portfolio view</h2><p>Each refresh writes provider evidence to the database, reconciles all successful sources, and promotes the result in one step. The current view stays visible while that happens.</p></div><div className="data-hero__score"><strong>{sources.filter((source) => source.status === "succeeded").length}</strong><span>live sources updated</span></div></section>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Portfolio view" value={`${portfolio.data?.tokens.length ?? 0} assets`} detail={`${portfolio.data?.chains.length ?? 0} networks · ${portfolio.data?.protocols.length ?? 0} protocols`} />
            <MetricCard label="Wallet coverage" value={`${sources.reduce((sum, source) => sum + source.walletCount, 0)} checks`} detail={`${sources.length} provider and carried-forward sources`} />
            <MetricCard label="Last update" value={shortDate(status.data.updatedAt)} detail={friendlyRefreshStatus(status.data.status)} />
          </div>
          <section className="panel">
            <div className="panel__header"><div><p className="eyebrow">Source health</p><h2>Chain and provider results</h2></div></div>
            <ul className="warning-list">{sources.map((source) => <li key={source.source}><strong className={source.status === "succeeded" ? "positive" : ""}>{friendlySourceName(source.source)}</strong><span>{source.status} · {source.holdingCount} assets · {source.walletCount} wallets</span></li>)}</ul>
            <p className="source-foot">Reconciled {dateTime(status.data.updatedAt)} · Job {status.data.jobId.slice(0, 8)}</p>
          </section>
        </>
      )}
    </Page>
  );
}

function refreshSourceRows(values: unknown[]) {
  return values.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    if (typeof row.source !== "string" || typeof row.status !== "string") return [];
    return [{ source: row.source, status: row.status, walletCount: numeric(row.walletCount), holdingCount: numeric(row.holdingCount) }];
  });
}

function numeric(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function friendlySourceName(value: string) { return value.replace(/^carried-forward:/, "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function PortfolioChart({ history, currency }: { history: LegacySnapshotHistoryPoint[]; currency: string }) {
  const [range, setRange] = useState<"3m" | "1y" | "all">("1y");
  const points = useMemo(() => {
    const days = range === "3m" ? 90 : range === "1y" ? 365 : Number.POSITIVE_INFINITY;
    const cutoff = Date.now() - days * 86_400_000;
    return history.filter((point) => new Date(point.asOf).getTime() >= cutoff);
  }, [history, range]);
  const values = points.map((point) => decimalAtomic(point.totalUsdValue));
  const min = values.reduce((lowest, value) => value < lowest ? value : lowest, values[0] ?? 0n);
  const max = values.reduce((highest, value) => value > highest ? value : highest, values[0] ?? 0n);
  const spread = max > min ? max - min : 1n;
  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 1000;
    const y = 240n - ((decimalAtomic(point.totalUsdValue) - min) * 210n) / spread;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,250 ${coordinates} 1000,250`;
  return (
    <div className="chart-wrap">
      <div className="range-control" aria-label="Chart range">{(["3m", "1y", "all"] as const).map((item) => <button key={item} data-active={range === item} onClick={() => setRange(item)}>{item === "all" ? "All" : item.toUpperCase()}</button>)}</div>
      <svg className="history-chart" viewBox="0 0 1000 260" role="img" aria-label={`Portfolio history from ${money(atomicDecimal(min), currency, 0)} to ${money(atomicDecimal(max), currency, 0)}`} preserveAspectRatio="none">
        <defs><linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
        <polygon points={area} fill="url(#historyFill)" /><polyline points={coordinates} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-axis"><span>{points[0] ? shortDate(points[0].asOf) : "—"}</span><strong>{money(points.at(-1)?.totalUsdValue ?? "0", currency, 0)}</strong><span>{points.at(-1) ? shortDate(points.at(-1)?.asOf ?? "") : "—"}</span></div>
    </div>
  );
}

function HoldingRow({ token, total, rank }: { token: LegacySnapshotToken; total: string; rank: number }) {
  return <div className="holding-row"><span className="rank">{rank}</span><Logo src={token.logoUrl} label={token.symbol} /><div className="holding-row__name"><strong>{token.symbol}</strong><small>{token.name}</small></div><div className="holding-row__value"><strong>{money(token.totalUsdValue, "USD", 0)}</strong><small>{percent(token.totalUsdValue, total, 1)}%</small></div></div>;
}

function NetworkRow({ chain, total }: { chain: LegacySnapshotChain; total: string }) {
  const valueShare = percent(chain.usdValue, total, 1);
  return <div className="network-row"><Logo src={chain.logoUrl} label={chain.name} /><div><div><strong>{chain.name}</strong><span>{money(chain.usdValue, "USD", 0)}</span></div><div className="progress"><i style={{ width: `${valueShare}%` }} /></div></div></div>;
}

function AssetDetailRow({ token, currency }: { token: LegacySnapshotToken; currency: string }) {
  const change = token.price24hChange;
  const changePositive = change === null || !change.startsWith("-");
  const priceDecimals = decimalAtomic(token.price) < DECIMAL_SCALE ? 4 : 2;
  return <div className="asset-row"><div className="identity"><Logo src={token.logoUrl} label={token.symbol} /><div><strong>{token.symbol}</strong><small>{token.name}</small></div></div><div className="asset-row__wallets">{token.wallets.slice(0, 3).map((wallet) => <span key={`${wallet.tag}:${wallet.amount}`}>{wallet.tag}</span>)}{token.wallets.length > 3 && <span>+{token.wallets.length - 3}</span>}</div><div className="asset-row__price"><strong>{money(token.price, currency, priceDecimals)}</strong>{change !== null && <small className={changePositive ? "positive" : "negative"}>{changePositive ? "+" : ""}{shortDecimal(change, 2)}%</small>}</div><div className="asset-row__balance"><strong>{money(token.totalUsdValue, currency, 0)}</strong><small>{quantity(token.amount)} {token.symbol}</small></div></div>;
}

function ProtocolCard({ protocol, currency }: { protocol: LegacySnapshotProtocol; currency: string }) {
  return <section className="panel protocol-card"><div className="protocol-card__header"><div className="identity"><Logo src={protocol.logoUrl} label={protocol.name} size="medium" /><div><h2>{protocol.name}</h2><p>{protocol.positions.length} {protocol.positions.length === 1 ? "position" : "positions"}</p></div></div><strong>{money(protocol.totalUsdValue, currency, 0)}</strong></div><div className="protocol-positions">{protocol.positions.map((position, index) => <div key={`${position.type}:${index}`}><div><strong>{position.type}</strong><small>{position.tokenNames} · {position.chainId.toUpperCase()}</small></div><div><strong>{money(position.usdValue, currency, 0)}</strong><small>{position.walletTags.join(", ")}</small></div></div>)}</div></section>;
}

function ActivityItem({ item }: { item: LegacyActivityRow }) {
  const label = item.merchant || item.type || "Transaction";
  const isGnosisPay = item.exchange.trim().toLowerCase() === "gnosis pay";
  const gnosisMinorUnits = item.billingAmount ?? item.amount;
  const displayedAmount = isGnosisPay && gnosisMinorUnits
    ? fixedMoney(minorUnits(gnosisMinorUnits), "EUR", 2)
    : item.amount ? quantity(item.amount) : "—";
  return <article className="activity-item"><div className="activity-icon">{(item.asset || item.exchange).slice(0, 1).toUpperCase()}</div><div><strong>{label}</strong><small>{isGnosisPay ? "Gnosis Pay · EUR card payment" : `${item.exchange} · ${item.asset || "No asset"}`}</small></div><time>{new Date(item.effectiveAt).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}</time><div className="activity-amount"><strong>{displayedAmount}</strong><small>{item.fee && decimalAtomic(item.fee) !== 0n ? `Fee ${quantity(item.fee)}` : item.excludedFromTotals ? "Excluded" : "Imported"}</small></div></article>;
}

function FilterBar(props: { search: string; setSearch: (value: string) => void; placeholder: string; children: ReactNode }) {
  return <div className="filter-bar"><label><span className="search-symbol">⌕</span><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder={props.placeholder} aria-label={props.placeholder} /></label>{props.children}</div>;
}

function Logo({ src, label, size = "small" }: { src: string | null; label: string; size?: "small" | "medium" }) {
  const [failed, setFailed] = useState(false);
  return <span className={`asset-logo asset-logo--${size}`}>{src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : <span>{label.slice(0, 2).toUpperCase()}</span>}</span>;
}

function SectionHeader({ eyebrow, title, link }: { eyebrow: string; title: string; link?: string }) {
  return <div className="panel__header compact"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{link && <a className="text-link" href={link}>View all →</a>}</div>;
}

function Page(props: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return <><header className="page-header"><div><p className="eyebrow">{props.eyebrow}</p><h1>{props.title}</h1></div>{props.action}</header>{props.children}</>;
}

function LoadingState() { return <div className="loading-grid" aria-label="Loading portfolio"><div /><div /><div /></div>; }
function ErrorState({ error }: { error: Error }) { const signedOut = error instanceof ApiRequestError && error.status === 401; return <section className="panel empty-panel" role="alert"><div className="empty-glyph">!</div><h2>{signedOut ? "Sign in required" : "Portfolio unavailable"}</h2><p>{error.message}</p></section>; }
function PlaceholderPanel({ text }: { text: string }) { return <section className="panel empty-panel"><div className="empty-glyph">◇</div><h2>Nothing to show yet</h2><p>{text}</p></section>; }
function EmptyResult() { return <section className="panel empty-result"><strong>No matching records</strong><span>Try a different search or filter.</span></section>; }

function byUsdValue(a: LegacySnapshotToken, b: LegacySnapshotToken) { return compareDecimals(b.totalUsdValue, a.totalUsdValue); }
function byChainValue(a: LegacySnapshotChain, b: LegacySnapshotChain) { return compareDecimals(b.usdValue, a.usdValue); }
function byProtocolValue(a: LegacySnapshotProtocol, b: LegacySnapshotProtocol) { return compareDecimals(b.totalUsdValue, a.totalUsdValue); }
function money(value: string, currency: string, decimals = 2) { const formatted = shortDecimal(value, decimals); const [whole, fraction] = formatted.split("."); const negative = whole?.startsWith("-"); const digits = negative ? whole?.slice(1) : whole; const grouped = swissGroup(digits ?? "0"); const code = currency === "$" ? "USD" : currency; return `${code} ${negative ? "−" : ""}${grouped}${fraction ? `.${fraction}` : ""}`; }
function fixedMoney(value: string, currency: string, decimals: number) { const formatted = formatDecimal(value, decimals); const [whole, fraction] = formatted.split("."); const negative = whole?.startsWith("-"); const digits = negative ? whole?.slice(1) : whole; return `${currency} ${negative ? "−" : ""}${swissGroup(digits ?? "0")}${fraction ? `.${fraction}` : ""}`; }
function quantity(value: string) { const precision = decimalAtomic(value) < DECIMAL_SCALE / 100n && decimalAtomic(value) > -(DECIMAL_SCALE / 100n) ? 4 : 2; const formatted = shortDecimal(value, precision); const [whole, fraction] = formatted.split("."); return `${swissGroup(whole ?? "0")}${fraction ? `.${fraction}` : ""}`; }
const DECIMAL_PLACES = 18;
const DECIMAL_SCALE = 10n ** BigInt(DECIMAL_PLACES);
function decimalAtomic(value: string): bigint { const negative = value.startsWith("-"); const source = negative ? value.slice(1) : value; const [whole = "0", fraction = ""] = source.split("."); const atomic = BigInt(`${whole || "0"}${fraction.padEnd(DECIMAL_PLACES, "0").slice(0, DECIMAL_PLACES)}`); return negative ? -atomic : atomic; }
function atomicDecimal(value: bigint): string { const negative = value < 0n; const absolute = negative ? -value : value; const digits = absolute.toString().padStart(DECIMAL_PLACES + 1, "0"); const whole = digits.slice(0, -DECIMAL_PLACES); const fraction = digits.slice(-DECIMAL_PLACES).replace(/0+$/, ""); return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`; }
function compareDecimals(left: string, right: string): number { const a = decimalAtomic(left); const b = decimalAtomic(right); return a === b ? 0 : a > b ? 1 : -1; }
function subtractDecimals(left: string, right: string): string { return atomicDecimal(decimalAtomic(left) - decimalAtomic(right)); }
function minorUnits(value: string): string { return atomicDecimal(decimalAtomic(value) / 100n); }
function percent(value: string, total: string, decimals: number): string { const denominator = decimalAtomic(total); if (denominator === 0n) return "0"; const scale = 10n ** BigInt(decimals); const numerator = decimalAtomic(value) * 100n * scale; const rounded = (numerator + denominator / 2n) / denominator; const text = rounded.toString().padStart(decimals + 1, "0"); return decimals ? `${text.slice(0, -decimals)}.${text.slice(-decimals)}` : text; }
function formatDecimal(value: string, decimals: number): string { const atomic = decimalAtomic(value); const negative = atomic < 0n; const absolute = negative ? -atomic : atomic; const divisor = 10n ** BigInt(DECIMAL_PLACES - decimals); const rounded = (absolute + divisor / 2n) / divisor; const text = rounded.toString().padStart(decimals + 1, "0"); const whole = decimals ? text.slice(0, -decimals) : text; const fraction = decimals ? text.slice(-decimals) : ""; return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`; }
function shortDecimal(value: string, decimals: number): string { const [whole, fraction] = formatDecimal(value, decimals).split("."); const shortened = fraction?.replace(/0+$/, "") ?? ""; return `${whole ?? "0"}${shortened ? `.${shortened}` : ""}`; }
function swissGroup(value: string): string { const negative = value.startsWith("-"); const digits = negative ? value.slice(1) : value; const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "’"); return `${negative ? "−" : ""}${grouped}`; }
function integer(value: number) { return value.toLocaleString("de-CH"); }
function dateTime(value: string) { return new Date(value).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" }); }
function shortDate(value: string) { return new Date(value).toLocaleDateString("de-CH", { month: "short", year: "2-digit" }); }
function groupActivity(items: LegacyActivityRow[]): Array<[string, LegacyActivityRow[]]> { const groups = new Map<string, LegacyActivityRow[]>(); for (const item of items) { const month = new Date(item.effectiveAt).toLocaleDateString("de-CH", { month: "long", year: "numeric" }); groups.set(month, [...(groups.get(month) ?? []), item]); } return [...groups]; }
function friendlyReason(reason: string) { return reason.replace(/^legacy_/, "").replaceAll("_", " "); }
