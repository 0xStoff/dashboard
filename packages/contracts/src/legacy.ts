import { Type, type Static } from "@sinclair/typebox";

import { DecimalString, IsoDateTime, Uuid } from "./common.js";

export const LegacyAssetRow = Type.Object({
  id: Uuid,
  walletId: Type.Union([Uuid, Type.Null()]),
  walletLabel: Type.Union([Type.String(), Type.Null()]),
  legacyChainId: Type.String(),
  symbol: Type.String(),
  name: Type.String(),
  amount: DecimalString,
  rawAmount: Type.String({ pattern: "^-?(?:0|[1-9][0-9]*)$" }),
  sourceUsdValue: DecimalString,
  status: Type.Literal("unverified"),
});

export const LegacyActivityRow = Type.Object({
  id: Uuid,
  exchange: Type.String(),
  sourceKey: Type.String(),
  type: Type.Union([Type.String(), Type.Null()]),
  asset: Type.Union([Type.String(), Type.Null()]),
  amount: Type.Union([DecimalString, Type.Null()]),
  fee: Type.Union([DecimalString, Type.Null()]),
  transactionAmount: Type.Union([DecimalString, Type.Null()]),
  billingAmount: Type.Union([DecimalString, Type.Null()]),
  merchant: Type.Union([Type.String(), Type.Null()]),
  effectiveAt: IsoDateTime,
  excludedFromTotals: Type.Boolean(),
  status: Type.Literal("unclassified"),
});

export const LegacyMigrationStatus = Type.Object({
  importBatchId: Uuid,
  sourceCommit: Type.Union([Type.String(), Type.Null()]),
  completedAt: IsoDateTime,
  sourceRecordCount: Type.Integer({ minimum: 0 }),
  importedRecordCount: Type.Integer({ minimum: 0 }),
  walletCount: Type.Integer({ minimum: 0 }),
  balanceCandidateCount: Type.Integer({ minimum: 0 }),
  transactionCandidateCount: Type.Integer({ minimum: 0 }),
  protocolCandidateCount: Type.Integer({ minimum: 0 }),
  unverifiedSnapshotCount: Type.Integer({ minimum: 0 }),
  quarantine: Type.Array(Type.Object({ reason: Type.String(), count: Type.Integer({ minimum: 0 }) })),
});

const LegacyLogoUrl = Type.Union([Type.String(), Type.Null()]);

export const LegacySnapshotWallet = Type.Object({
  tag: Type.String(),
  amount: DecimalString,
});

export const LegacySnapshotToken = Type.Object({
  key: Type.String(),
  name: Type.String(),
  symbol: Type.String(),
  chainId: Type.String(),
  decimals: Type.Union([Type.Integer(), Type.Null()]),
  logoUrl: LegacyLogoUrl,
  price: DecimalString,
  price24hChange: Type.Union([DecimalString, Type.Null()]),
  amount: DecimalString,
  totalUsdValue: DecimalString,
  wallets: Type.Array(LegacySnapshotWallet),
});

export const LegacySnapshotChain = Type.Object({
  chainId: Type.String(),
  name: Type.String(),
  logoUrl: LegacyLogoUrl,
  usdValue: DecimalString,
  tokenUsdValue: DecimalString,
  protocolUsdValue: DecimalString,
});

export const LegacySnapshotProtocolPosition = Type.Object({
  type: Type.String(),
  chainId: Type.String(),
  amount: DecimalString,
  price: DecimalString,
  usdValue: DecimalString,
  tokenNames: Type.String(),
  walletTags: Type.Array(Type.String()),
});

export const LegacySnapshotProtocol = Type.Object({
  key: Type.String(),
  name: Type.String(),
  logoUrl: LegacyLogoUrl,
  totalUsdValue: DecimalString,
  positions: Type.Array(LegacySnapshotProtocolPosition),
});

export const LegacySnapshotHistoryPoint = Type.Object({
  asOf: IsoDateTime,
  totalUsdValue: DecimalString,
});

export const LegacyPortfolioSnapshot = Type.Object({
  asOf: IsoDateTime,
  currency: Type.String(),
  totalUsdValue: DecimalString,
  totalTokenUsdValue: DecimalString,
  totalProtocolUsdValue: DecimalString,
  tokens: Type.Array(LegacySnapshotToken),
  chains: Type.Array(LegacySnapshotChain),
  protocols: Type.Array(LegacySnapshotProtocol),
  walletCount: Type.Integer({ minimum: 0 }),
  history: Type.Array(LegacySnapshotHistoryPoint),
  status: Type.Union([Type.Literal("legacy_unverified"), Type.Literal("live_refreshed")]),
});

export type LegacyAssetRow = Static<typeof LegacyAssetRow>;
export type LegacyActivityRow = Static<typeof LegacyActivityRow>;
export type LegacyMigrationStatus = Static<typeof LegacyMigrationStatus>;
export type LegacySnapshotWallet = Static<typeof LegacySnapshotWallet>;
export type LegacySnapshotToken = Static<typeof LegacySnapshotToken>;
export type LegacySnapshotChain = Static<typeof LegacySnapshotChain>;
export type LegacySnapshotProtocolPosition = Static<typeof LegacySnapshotProtocolPosition>;
export type LegacySnapshotProtocol = Static<typeof LegacySnapshotProtocol>;
export type LegacySnapshotHistoryPoint = Static<typeof LegacySnapshotHistoryPoint>;
export type LegacyPortfolioSnapshot = Static<typeof LegacyPortfolioSnapshot>;
