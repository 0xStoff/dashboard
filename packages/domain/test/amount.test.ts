import assert from "node:assert/strict";
import test from "node:test";

import {
  addAtomic,
  addDecimal,
  atomicAmount,
  atomicToDecimal,
  decimalAmount,
  decimalToAtomic,
  multiplyDecimal,
  subtractAtomic,
} from "../src/amount.ts";

test("atomic arithmetic remains exact beyond Number.MAX_SAFE_INTEGER", () => {
  const large = atomicAmount("9007199254740993123456789");
  assert.equal(addAtomic(large, atomicAmount("11")), "9007199254740993123456800");
  assert.equal(subtractAtomic(large, atomicAmount("9")), "9007199254740993123456780");
});

test("decimal arithmetic never passes through binary floating point", () => {
  assert.equal(addDecimal(decimalAmount("0.1"), decimalAmount("0.2")), "0.3");
  assert.equal(multiplyDecimal(decimalAmount("1.25"), decimalAmount("2.4")), "3");
  assert.equal(multiplyDecimal(decimalAmount("-0.1"), decimalAmount("2.5")), "-0.25");
});

test("atomic conversion is exact and rejects precision loss", () => {
  assert.equal(atomicToDecimal(atomicAmount("123456789"), 6), "123.456789");
  assert.equal(decimalToAtomic(decimalAmount("123.456789"), 6), "123456789");
  assert.throws(() => decimalToAtomic(decimalAmount("0.001"), 2), /cannot be represented exactly/);
});

test("non-canonical amounts are rejected", () => {
  assert.throws(() => atomicAmount("01"));
  assert.throws(() => decimalAmount("1e6"));
  assert.throws(() => decimalAmount("NaN"));
});
