import { createHash, randomUUID } from "node:crypto";

import { Type } from "@sinclair/typebox";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import {
  ApiError,
  LegacyActivityRow,
  LegacyAssetRow,
  LegacyMigrationStatus,
  LegacyPortfolioSnapshot,
  PortfolioRefreshStatus,
  PortfolioSummary,
} from "@dashboard/contracts";
import {
  authenticateSession,
  findLegacyActivity,
  findLegacyAssets,
  findLegacyMigrationStatus,
  findPortfolio,
  findLatestPortfolioSummary,
  enqueuePortfolioRefresh,
  findPortfolioRefreshStatus,
  type DatabasePool,
  localSnapshotPrincipal,
  type SessionPrincipal,
} from "@dashboard/database";

const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("degraded")]),
  service: Type.Literal("portfolio-api"),
  database: Type.Union([Type.Literal("reachable"), Type.Literal("unreachable")]),
});

export function buildApp(pool: DatabasePool, localSnapshotAccountId: string | null = null) {
  const app = Fastify({
    logger: { redact: ["req.headers.cookie", "req.headers.authorization"] },
    genReqId: () => randomUUID(),
    trustProxy: true,
  });

  app.get("/api/health", { schema: { response: { 200: HealthResponse, 503: HealthResponse } } }, async (_request, reply) => {
    try {
      await pool.query("select 1");
      return { status: "ok" as const, service: "portfolio-api" as const, database: "reachable" as const };
    } catch {
      return reply.code(503).send({ status: "degraded", service: "portfolio-api", database: "unreachable" });
    }
  });

  app.get("/api/v2/portfolio/summary", {
    schema: { response: { 200: PortfolioSummary, 401: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    return findLatestPortfolioSummary(pool, principal.accountId, principal.reportingCurrency);
  });

  app.get("/api/v2/legacy/assets", {
    schema: { response: { 200: Type.Array(LegacyAssetRow), 401: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    return findLegacyAssets(pool, principal.accountId);
  });

  app.get("/api/v2/portfolio", {
    schema: { response: { 200: Type.Union([LegacyPortfolioSnapshot, Type.Null()]), 401: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    return findPortfolio(pool, principal.accountId);
  });

  app.get("/api/v2/legacy/activity", {
    schema: {
      querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 2_000 })) }),
      response: { 200: Type.Array(LegacyActivityRow), 401: ApiError },
    },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    const limit = Number((request.query as { limit?: number }).limit ?? 200);
    return findLegacyActivity(pool, principal.accountId, limit);
  });

  app.get("/api/v2/legacy/status", {
    schema: { response: { 200: Type.Union([LegacyMigrationStatus, Type.Null()]), 401: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    return findLegacyMigrationStatus(pool, principal.accountId);
  });

  app.get("/api/v2/portfolio/refresh", {
    schema: { response: { 200: Type.Union([PortfolioRefreshStatus, Type.Null()]), 401: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    return findPortfolioRefreshStatus(pool, principal.accountId);
  });

  app.post("/api/v2/portfolio/refresh", {
    schema: { response: { 202: PortfolioRefreshStatus, 401: ApiError, 403: ApiError } },
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, pool, localSnapshotAccountId);
    if (!principal) return;
    if (principal.role === "viewer") {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "This account is read only.", requestId: request.id } });
    }
    const status = await enqueuePortfolioRefresh(pool, principal.accountId);
    return reply.code(202).send(status);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", requestId: request.id },
    });
  });

  return app;
}

async function requirePrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  pool: DatabasePool,
  localSnapshotAccountId: string | null,
): Promise<SessionPrincipal | null> {
  if (localSnapshotAccountId) {
    const principal = await localSnapshotPrincipal(pool, localSnapshotAccountId);
    if (principal) {
      void reply.header("x-dashboard-auth-mode", "local-snapshot");
      return principal;
    }
  }
  const token = cookieValue(request.headers.cookie, "portfolio_session");
  if (!token || token.length < 32 || token.length > 512) {
    await unauthorized(reply, request.id);
    return null;
  }
  const principal = await authenticateSession(pool, createHash("sha256").update(token).digest("hex"));
  if (!principal) {
    await unauthorized(reply, request.id);
    return null;
  }
  return principal;
}

async function unauthorized(reply: FastifyReply, requestId: string): Promise<void> {
  await reply.code(401).send({
    error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in to view this portfolio.", requestId },
  });
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
