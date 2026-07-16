import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedNext,
  countFailedAttempts,
  isReturning,
  selectableTrackingStatuses,
} from "./statusWorkflow.js";

test("allowedNext follows the transition map", () => {
  assert.deepEqual(allowedNext("Order Created"), ["Picked Up"]);
  assert.deepEqual(allowedNext("Picked Up"), ["Arrived at Branch", "Out for Delivery"]);
  assert.deepEqual(allowedNext("Arrived at Branch"), ["Departed Branch", "Out for Delivery"]);
  assert.deepEqual(allowedNext("Departed Branch"), [
    "Arrived at Branch",
    "Out for Delivery",
  ]);
  assert.deepEqual(allowedNext("Out for Delivery"), ["Delivered", "Delivery Failed"]);
});

test("allowedNext gates the Delivery Failed edge on fail count", () => {
  assert.deepEqual(allowedNext("Delivery Failed", 1), ["Out for Delivery"]);
  assert.deepEqual(allowedNext("Delivery Failed", 2), ["Out for Delivery"]);
  assert.deepEqual(allowedNext("Delivery Failed", 3), ["Arrived at Branch"]);
});

test("allowedNext locks the return leg through Out for Return at fails>=3", () => {
  assert.deepEqual(allowedNext("Arrived at Branch", 0), ["Departed Branch", "Out for Delivery"]);
  assert.deepEqual(allowedNext("Arrived at Branch", 3), ["Out for Return"]);
  assert.deepEqual(allowedNext("Out for Return", 3), ["Returned"]);
  assert.deepEqual(allowedNext("Out for Return", 2), []);
});

test("allowedNext locks terminal statuses", () => {
  assert.deepEqual(allowedNext("Delivered"), []);
  assert.deepEqual(allowedNext("Returned"), []);
  assert.deepEqual(allowedNext("Cancelled"), []);
});

test("selectableTrackingStatuses binds privileged users to the map plus Cancelled", () => {
  // Coordinators follow the same checkpoint map as couriers; their only extra
  // move is Cancelled (never off a terminal status).
  assert.deepEqual(selectableTrackingStatuses("Out for Delivery", true), [
    "Delivered",
    "Delivery Failed",
    "Cancelled",
  ]);
  assert.deepEqual(selectableTrackingStatuses("Arrived at Branch", true), [
    "Departed Branch",
    "Out for Delivery",
    "Cancelled",
  ]);
  assert.deepEqual(selectableTrackingStatuses("Out for Return", true, 3), [
    "Returned",
    "Cancelled",
  ]);
  assert.deepEqual(selectableTrackingStatuses("Delivered", true), []);
});

test("selectableTrackingStatuses never offers Cancelled to couriers", () => {
  for (const status of [null, "Order Created", "Departed Branch", "Out for Delivery"]) {
    assert.equal(selectableTrackingStatuses(status, false).includes("Cancelled"), false);
  }
});

test("isReturning flags the post-3rd-fail leg until Returned", () => {
  assert.equal(isReturning("Delivery Failed", 3), true);
  assert.equal(isReturning("Arrived at Branch", 3), true);
  assert.equal(isReturning("Out for Return", 3), true);
  assert.equal(isReturning("Returned", 3), false);
  assert.equal(isReturning("Out for Delivery", 2), false);
});

test("countFailedAttempts derives the count from tracking history", () => {
  const history = [
    { status_update: "Out for Delivery" },
    { status_update: "Delivery Failed" },
    { status_update: "Out for Delivery" },
    { status_update: "Delivery Failed" },
  ];
  assert.equal(countFailedAttempts(history), 2);
  assert.equal(countFailedAttempts(null), 0);
});
