import assert from "node:assert/strict";
import test from "node:test";
import { validateCoordinatePair } from "./location.js";

// Pure unit tests — run without DATABASE_URL.

function ok(latitude, longitude) {
  return { ok: true, latitude, longitude };
}

test("valid pairs pass and are returned as numbers", () => {
  assert.deepEqual(validateCoordinatePair(10.3283, 123.8988), ok(10.3283, 123.8988));
  assert.deepEqual(validateCoordinatePair(-7.5, -45.25), ok(-7.5, -45.25));
});

test("boundary values are accepted", () => {
  assert.deepEqual(validateCoordinatePair(90, 180), ok(90, 180));
  assert.deepEqual(validateCoordinatePair(-90, -180), ok(-90, -180));
});

test("both null (or undefined) is a valid unpin", () => {
  assert.deepEqual(validateCoordinatePair(null, null), ok(null, null));
  assert.deepEqual(validateCoordinatePair(undefined, undefined), ok(null, null));
  assert.deepEqual(validateCoordinatePair(null, undefined), ok(null, null));
});

test("a lone coordinate is rejected", () => {
  assert.equal(validateCoordinatePair(10.3283, null).ok, false);
  assert.equal(validateCoordinatePair(null, 123.8988).ok, false);
  assert.equal(validateCoordinatePair(10.3283, undefined).ok, false);
});

test("Number(null) trap: null never coerces to 0", () => {
  const result = validateCoordinatePair(null, 123.8988);
  assert.equal(result.ok, false);
  assert.match(result.error, /together/);
});

test("empty and whitespace strings are rejected, not coerced to 0", () => {
  assert.equal(validateCoordinatePair("", 123.8988).ok, false);
  assert.equal(validateCoordinatePair(10.3283, "").ok, false);
  assert.equal(validateCoordinatePair("   ", 123.8988).ok, false);
});

test("numeric strings are accepted via guarded coercion", () => {
  assert.deepEqual(validateCoordinatePair("10.3283", "123.8988"), ok(10.3283, 123.8988));
  assert.deepEqual(validateCoordinatePair(" -7.5 ", "45"), ok(-7.5, 45));
});

test("non-numeric strings and non-number types are rejected", () => {
  assert.equal(validateCoordinatePair("north", "123").ok, false);
  assert.equal(validateCoordinatePair("10.3", "12,3").ok, false);
  assert.equal(validateCoordinatePair(true, 123.8988).ok, false);
  assert.equal(validateCoordinatePair([10.3], [123.8]).ok, false);
  assert.equal(validateCoordinatePair({}, 123.8988).ok, false);
});

test("NaN and Infinity are rejected", () => {
  assert.equal(validateCoordinatePair(NaN, 123.8988).ok, false);
  assert.equal(validateCoordinatePair(10.3283, Infinity).ok, false);
  assert.equal(validateCoordinatePair(-Infinity, 123.8988).ok, false);
  assert.equal(validateCoordinatePair("NaN", "123").ok, false);
  assert.equal(validateCoordinatePair("Infinity", "123").ok, false);
});

test("out-of-range values are rejected on both bounds", () => {
  assert.equal(validateCoordinatePair(90.0000001, 123).ok, false);
  assert.equal(validateCoordinatePair(-90.0000001, 123).ok, false);
  assert.equal(validateCoordinatePair(10, 180.0000001).ok, false);
  assert.equal(validateCoordinatePair(10, -180.0000001).ok, false);
});

test("exact (0,0) is rejected, including -0 and string zeros", () => {
  assert.equal(validateCoordinatePair(0, 0).ok, false);
  assert.equal(validateCoordinatePair(-0, 0).ok, false);
  assert.equal(validateCoordinatePair(-0, -0).ok, false);
  assert.equal(validateCoordinatePair("0", "0").ok, false);
  assert.equal(validateCoordinatePair("0.0", "-0.0").ok, false);
});

test("a single zero coordinate is fine and -0 normalizes to 0", () => {
  assert.deepEqual(validateCoordinatePair(0, 123.8988), ok(0, 123.8988));
  const result = validateCoordinatePair(-0, 123.8988);
  assert.equal(result.ok, true);
  assert.ok(Object.is(result.latitude, 0), "-0 must normalize to 0");
});
