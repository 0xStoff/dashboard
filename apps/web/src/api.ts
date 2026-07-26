import type {
  LegacyActivityRow,
  LegacyAssetRow,
  LegacyMigrationStatus,
  LegacyPortfolioSnapshot,
  PortfolioSummary,
  PortfolioRefreshStatus,
} from "@dashboard/contracts";

export class ApiRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function getPortfolioSummary(signal?: AbortSignal): Promise<PortfolioSummary> {
  return apiGet<PortfolioSummary>("/api/v2/portfolio/summary", signal);
}

export async function getLegacyAssets(signal?: AbortSignal): Promise<LegacyAssetRow[]> {
  return apiGet<LegacyAssetRow[]>("/api/v2/legacy/assets", signal);
}

export async function getPortfolio(signal?: AbortSignal): Promise<LegacyPortfolioSnapshot | null> {
  return apiGet<LegacyPortfolioSnapshot | null>("/api/v2/portfolio", signal);
}

export async function getLegacyActivity(signal?: AbortSignal): Promise<LegacyActivityRow[]> {
  return apiGet<LegacyActivityRow[]>("/api/v2/legacy/activity?limit=1500", signal);
}

export async function getLegacyMigrationStatus(signal?: AbortSignal): Promise<LegacyMigrationStatus | null> {
  return apiGet<LegacyMigrationStatus | null>("/api/v2/legacy/status", signal);
}

export async function getPortfolioRefreshStatus(signal?: AbortSignal): Promise<PortfolioRefreshStatus | null> {
  return apiGet<PortfolioRefreshStatus | null>("/api/v2/portfolio/refresh", signal);
}

export async function startPortfolioRefresh(): Promise<PortfolioRefreshStatus> {
  const response = await fetch("/api/v2/portfolio/refresh", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiRequestError(response.status, body?.error?.message ?? "The refresh could not be started.");
  }
  return response.json() as Promise<PortfolioRefreshStatus>;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiRequestError(response.status, body?.error?.message ?? "Portfolio data is unavailable.");
  }
  return response.json() as Promise<T>;
}
