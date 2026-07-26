import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { ActivityPage, AssetsPage, OverviewPage, PositionsPage, SourcesPage } from "./views.js";

const navigation = [
  ["/", "Overview", "⌂"],
  ["/assets", "Holdings", "◫"],
  ["/positions", "DeFi", "◎"],
  ["/activity", "Activity", "↕"],
  ["/sources", "Data sources", "◇"],
] as const;

function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Portfolio ledger home">
          <span className="brand__mark">π</span>
          <span><strong>Portfolio</strong><small>Multi-chain wealth</small></span>
        </Link>
        <nav aria-label="Primary">
          {navigation.map(([to, label, icon]) => (
            <Link key={to} to={to} className="nav-link" activeProps={{ "data-active": true }} activeOptions={{ exact: to === "/" }}>
              <span aria-hidden="true">{icon}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar__foot">
          <span className="environment-dot" /> Live data
        </div>
      </aside>
      <main id="content" className="main-content" tabIndex={-1}><Outlet /></main>
    </div>
  );
}

const rootRoute = createRootRoute({ component: AppShell });
const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: OverviewPage });
const assetsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/assets", component: AssetsPage });
const positionsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/positions", component: PositionsPage });
const activityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/activity", component: ActivityPage });
const sourcesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/sources", component: SourcesPage });

const routeTree = rootRoute.addChildren([overviewRoute, assetsRoute, positionsRoute, activityRoute, sourcesRoute]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
