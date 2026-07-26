import assert from "node:assert/strict";
import test from "node:test";
import {
    addDecimal,
    atomicAmount,
    atomicToDecimal,
    decimalAmount,
    decimalToAtomic,
    multiplyDecimal,
    subtractDecimal,
} from "../domain/amounts.js";

test("keeps atomic blockchain amounts above Number.MAX_SAFE_INTEGER exact", () => {
    const raw = "123456789012345678901234567890";
    assert.equal(atomicAmount(raw), raw);
    assert.equal(atomicToDecimal(raw, 18), "123456789012.34567890123456789");
});

test("performs decimal accounting without binary floating-point loss", () => {
    assert.equal(addDecimal("0.1", "0.2"), "0.3");
    assert.equal(subtractDecimal("1000", "999.99"), "0.01");
    assert.equal(multiplyDecimal("12.34", "0.5"), "6.17");
    assert.equal(decimalAmount("1.00"), "1");
    assert.throws(() => decimalAmount("001"), /plain base-10 decimal/i);
});

test("rejects precision loss when converting to atomic units", () => {
    assert.equal(decimalToAtomic("1.23", 6), "1230000");
    assert.throws(() => decimalToAtomic("1.234", 2), /cannot be represented exactly/i);
    assert.throws(() => atomicAmount("1e18"), /canonical base-10 integer/i);
});
