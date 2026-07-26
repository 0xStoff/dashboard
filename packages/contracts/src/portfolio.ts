import { Type, type Static } from "@sinclair/typebox";

import { Completeness, Confidence, CurrencyCode, DecimalString, IsoDateTime, Uuid, Warning } from "./common.js";

export const ValuedAmount = Type.Object({
  amount: Type.Union([DecimalString, Type.Null()]),
  currency: CurrencyCode,
  completeness: Completeness,
  confidence: Confidence,
  calculationId: Type.Union([Uuid, Type.Null()]),
});

export const PortfolioSummary = Type.Object({
  accountId: Uuid,
  asOf: Type.Union([IsoDateTime, Type.Null()]),
  reportingCurrency: CurrencyCode,
  netWorth: ValuedAmount,
  costBasis: ValuedAmount,
  unrealizedPnl: ValuedAmount,
  freshness: Type.Union([
    Type.Literal("fresh"),
    Type.Literal("stale"),
    Type.Literal("syncing"),
    Type.Literal("unavailable"),
  ]),
  unpricedAssetCount: Type.Integer({ minimum: 0 }),
  unknownEventCount: Type.Integer({ minimum: 0 }),
  warnings: Type.Array(Warning),
});

export const CalculationExplanation = Type.Object({
  calculationId: Uuid,
  metric: Type.String(),
  formulaVersion: Type.String(),
  formula: Type.String(),
  reportingCurrency: CurrencyCode,
  asOf: IsoDateTime,
  completeness: Completeness,
  confidence: Confidence,
  includedSourceIds: Type.Array(Uuid),
  excludedRecordIds: Type.Array(Uuid),
  priceIds: Type.Array(Uuid),
  adjustmentIds: Type.Array(Uuid),
  warnings: Type.Array(Warning),
});

export type PortfolioSummary = Static<typeof PortfolioSummary>;
export type CalculationExplanation = Static<typeof CalculationExplanation>;
