import { Type, type Static } from "@sinclair/typebox";

import { IsoDateTime, Uuid, Warning } from "./common.js";

export const SyncCapability = Type.Union([
  Type.Literal("balances"),
  Type.Literal("transactions"),
  Type.Literal("prices"),
]);

export const EnqueueSyncRequest = Type.Object({
  connectionId: Uuid,
  walletId: Type.Optional(Uuid),
  capabilities: Type.Array(SyncCapability, { minItems: 1, uniqueItems: true }),
  reason: Type.Union([Type.Literal("manual"), Type.Literal("scheduled"), Type.Literal("repair")]),
});

export const SyncJob = Type.Object({
  jobId: Uuid,
  status: Type.Union([
    Type.Literal("queued"),
    Type.Literal("running"),
    Type.Literal("succeeded"),
    Type.Literal("partial"),
    Type.Literal("failed"),
    Type.Literal("cancelled"),
  ]),
  queuedAt: IsoDateTime,
  warnings: Type.Array(Warning),
});

export type EnqueueSyncRequest = Static<typeof EnqueueSyncRequest>;
export type SyncJob = Static<typeof SyncJob>;

export const PortfolioRefreshStatus = Type.Object({
  jobId: Uuid,
  status: Type.Union([Type.Literal("queued"), Type.Literal("running"), Type.Literal("succeeded"), Type.Literal("partial"), Type.Literal("failed"), Type.Literal("cancelled")]),
  queuedAt: IsoDateTime,
  updatedAt: IsoDateTime,
  errorCode: Type.Union([Type.String(), Type.Null()]),
  sources: Type.Array(Type.Unknown()),
});

export type PortfolioRefreshStatus = Static<typeof PortfolioRefreshStatus>;
