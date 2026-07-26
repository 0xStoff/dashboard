import { loadRuntimeConfig } from "@dashboard/config";
import { beginPortfolioRefreshRun, completePortfolioRefresh, createDatabase, failPortfolioRefresh, loadRefreshWallets } from "@dashboard/database";
import { refreshAllPortfolioChains } from "@dashboard/providers";

import { leaseNextJob, releaseUnconfiguredJob } from "./queue.js";
import { projectRefresh } from "./project-refresh.js";

const config = loadRuntimeConfig("worker");
const { pool } = createDatabase(config.database);
const workerId = process.env.WORKER_ID?.trim() || `worker-${process.pid}`;
const pollIntervalMs = boundedInteger(process.env.WORKER_POLL_INTERVAL_MS ?? "2000", 250, 60_000);
const leaseSeconds = boundedInteger(process.env.WORKER_LEASE_SECONDS ?? "60", 10, 3600);
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { stopping = true; });
}

while (!stopping) {
  const job = await leaseNextJob(pool, workerId, leaseSeconds);
  if (!job) {
    await delay(pollIntervalMs);
    continue;
  }
  try {
    const provider = String((job.request as { provider?: unknown } | null)?.provider ?? "");
    if (provider !== "local-multichain") {
      await releaseUnconfiguredJob(pool, job, "adapter execution is not enabled");
      continue;
    }
    const runId = await beginPortfolioRefreshRun(pool, job);
    try {
      const wallets = await loadRefreshWallets(pool, job.accountId);
      const signal = AbortSignal.timeout(120_000);
      const result = await refreshAllPortfolioChains(wallets, {
        debankAccessKey: process.env.RABBY_ACCESS_KEY,
        coingeckoApiKey: process.env.COINGECKO_API_KEY,
        solanaRpcUrl: process.env.SOLANA_RPC_URL,
        suiRpcUrl: process.env.SUI_RPC_URL,
        aptosApiUrl: process.env.APTOS_API_URL,
      }, signal);
      const projection = projectRefresh(result, wallets);
      await completePortfolioRefresh(pool, { jobId: job.id, accountId: job.accountId, connectionId: job.connectionId, runId, result, snapshot: projection.snapshot, totalValue: projection.totalValue, complete: result.complete });
    } catch (error) {
      await failPortfolioRefresh(pool, { jobId: job.id, accountId: job.accountId, runId, code: error instanceof Error && error.name === "TimeoutError" ? "REFRESH_TIMEOUT" : "REFRESH_FAILED" });
    }
  } catch (error) {
    await releaseUnconfiguredJob(pool, job, error instanceof Error ? error.message : "provider unavailable");
  }
}

await pool.end();

function boundedInteger(value: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error("invalid worker interval setting");
  return parsed;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
