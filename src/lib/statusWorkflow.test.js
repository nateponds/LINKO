import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedNext,
  countFailedAttempts,
  isReturning,
  returnTriggeredFromHistory,
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

test("allowedNext gates the Delivery Failed edge on the return-triggered flag", () => {
  assert.deepEqual(allowedNext("Delivery Failed", false), ["Out for Delivery"]);
  assert.deepEqual(allowedNext("Delivery Failed", true), ["Arrived at Branch"]);
});

test("allowedNext locks the return leg through Out for Return when triggered", () => {
  assert.deepEqual(allowedNext("Arrived at Branch", false), ["Departed Branch", "Out for Delivery"]);
  assert.deepEqual(allowedNext("Arrived at Branch", true), ["Out for Return"]);
  assert.deepEqual(allowedNext("Out for Return", true), ["Returned"]);
  assert.deepEqual(allowedNext("Out for Return", false), []);
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
  assert.deepEqual(selectableTrackingStatuses("Out for Return", true, true), [
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

test("isReturning flags the return leg until Returned", () => {
  assert.equal(isReturning("Delivery Failed", true), true);
  assert.equal(isReturning("Arrived at Branch", true), true);
  assert.equal(isReturning("Out for Return", true), true);
  assert.equal(isReturning("Returned", true), false);
  assert.equal(isReturning("Out for Delivery", false), false);
});

test("returnTriggeredFromHistory opens the return leg on retry cap or hard fail", () => {
  const softFail = { status_update: "Delivery Failed", remarks: "Receiver unavailable" };
  assert.equal(returnTriggeredFromHistory([softFail, softFail]), false);
  assert.equal(returnTriggeredFromHistory([softFail, softFail, softFail]), true);
  assert.equal(
    returnTriggeredFromHistory([{ status_update: "Delivery Failed", remarks: "Bad address" }]),
    true,
  );
  assert.equal(
    returnTriggeredFromHistory([
      { status_update: "Out for Delivery" },
      { status_update: "Delivered", remarks: "Bad address" },
      softFail,
    ]),
    false,
  );
  assert.equal(returnTriggeredFromHistory(null), false);
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
