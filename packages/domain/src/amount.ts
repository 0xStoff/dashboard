import type { Branded } from "./identity.js";

export type AtomicAmount = Branded<string, "AtomicAmount">;
export type DecimalAmount = Branded<string, "DecimalAmount">;

const integerPattern = /^-?(?:0|[1-9]\d*)$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

export function atomicAmount(value: string | bigint): AtomicAmount {
  const normalized = typeof value === "bigint" ? value.toString() : value.trim();
  if (!integerPattern.test(normalized) || normalized === "-0") {
    throw new TypeError("atomic amount must be a canonical base-10 integer string");
  }
  return normalized as AtomicAmount;
}

export function decimalAmount(value: string): DecimalAmount {
  return formatDecimal(parseDecimal(value));
}

export function addAtomic(left: AtomicAmount, right: AtomicAmount): AtomicAmount {
  return atomicAmount(BigInt(left) + BigInt(right));
}

export function subtractAtomic(left: AtomicAmount, right: AtomicAmount): AtomicAmount {
  return atomicAmount(BigInt(left) - BigInt(right));
}

export function compareAtomic(left: AtomicAmount, right: AtomicAmount): -1 | 0 | 1 {
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function addDecimal(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const [a, b] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: a.coefficient + b.coefficient, scale: a.scale });
}

export function subtractDecimal(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const [a, b] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: a.coefficient - b.coefficient, scale: a.scale });
}

export function multiplyDecimal(left: DecimalAmount, right: DecimalAmount): DecimalAmount {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  return formatDecimal({ coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale });
}

export function atomicToDecimal(value: AtomicAmount, decimals: number): DecimalAmount {
  assertScale(decimals);
  return formatDecimal({ coefficient: BigInt(value), scale: decimals });
}

export function decimalToAtomic(value: DecimalAmount, decimals: number): AtomicAmount {
  assertScale(decimals);
  const parsed = parseDecimal(value);
  if (parsed.scale > decimals) {
    const divisor = powerOfTen(parsed.scale - decimals);
    if (parsed.coefficient % divisor !== 0n) {
      throw new RangeError("decimal amount cannot be represented exactly at the requested scale");
    }
    return atomicAmount(parsed.coefficient / divisor);
  }
  return atomicAmount(parsed.coefficient * powerOfTen(decimals - parsed.scale));
}

function parseDecimal(value: string): ParsedDecimal {
  const normalized = value.trim();
  if (!decimalPattern.test(normalized)) {
    throw new TypeError("decimal amount must be a plain base-10 decimal string");
  }
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${negative ? "-" : ""}${whole}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function formatDecimal(value: ParsedDecimal): DecimalAmount {
  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  if (coefficient === 0n) return "0" as DecimalAmount;
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const split = scale === 0 ? digits.length : digits.length - scale;
  const rendered = scale === 0 ? digits : `${digits.slice(0, split)}.${digits.slice(split)}`;
  return `${negative ? "-" : ""}${rendered}` as DecimalAmount;
}

function align(left: ParsedDecimal, right: ParsedDecimal): [ParsedDecimal, ParsedDecimal] {
  const scale = Math.max(left.scale, right.scale);
  return [
    { coefficient: left.coefficient * powerOfTen(scale - left.scale), scale },
    { coefficient: right.coefficient * powerOfTen(scale - right.scale), scale },
  ];
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function assertScale(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new RangeError("decimal scale must be an integer between 0 and 255");
  }
}
