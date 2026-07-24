import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSavings,
  convertFromPhp,
  getSavingsRate,
} from "./savings.js";

test("savings rate scales from 15% to 32% with order volume", () => {
  assert.equal(getSavingsRate(50), 0.15);
  assert.equal(getSavingsRate(1_000), 0.32);
});

test("savings rate remains inside the advertised range", () => {
  assert.equal(getSavingsRate(0), 0.15);
  assert.equal(getSavingsRate(2_000), 0.32);
});

test("annual savings uses monthly spend and the volume-based rate", () => {
  assert.deepEqual(calculateSavings(100_000, 1_000), {
    annualSpend: 1_200_000,
    annualSavings: 384_000,
    linkoCost: 816_000,
    savingsRate: 0.32,
  });
});

test("PHP values convert to USD at the supplied exchange rate", () => {
  assert.equal(convertFromPhp(58_000, "USD", 58), 1_000);
  assert.equal(convertFromPhp(58_000, "PHP", 58), 58_000);
});
