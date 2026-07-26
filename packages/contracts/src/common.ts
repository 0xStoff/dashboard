import { Type, type Static } from "@sinclair/typebox";

export const Uuid = Type.String({ format: "uuid" });
export const IsoDateTime = Type.String({ format: "date-time" });
export const DecimalString = Type.String({ pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" });
export const CurrencyCode = Type.String({ pattern: "^[A-Z][A-Z0-9]{2,11}$" });

export const Completeness = Type.Union([
  Type.Literal("complete"),
  Type.Literal("partial"),
  Type.Literal("unknown"),
]);

export const Confidence = Type.Union([
  Type.Literal("high"),
  Type.Literal("medium"),
  Type.Literal("low"),
  Type.Literal("unknown"),
]);

export const Warning = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 80 }),
  message: Type.String({ minLength: 1, maxLength: 500 }),
});

export const ApiError = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
  }),
});

export type ApiError = Static<typeof ApiError>;
