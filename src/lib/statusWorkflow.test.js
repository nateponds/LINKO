import test from "node:test";
import assert from "node:assert/strict";

import { selectableTrackingStatuses } from "./statusWorkflow.js";

test("selectableTrackingStatuses hides completed phases from couriers", () => {
  assert.deepEqual(selectableTrackingStatuses("Out for Delivery", false), [
    "Out for Delivery",
    "Delivered",
    "Returned",
  ]);
});

test("selectableTrackingStatuses keeps all statuses available to privileged users", () => {
  assert.deepEqual(selectableTrackingStatuses("Out for Delivery", true), [
    "Order Created",
    "Picked Up",
    "In Transit",
    "Out for Delivery",
    "Delivered",
    "Returned",
    "Cancelled",
  ]);
});

test("selectableTrackingStatuses locks terminal statuses for couriers", () => {
  assert.deepEqual(selectableTrackingStatuses("Delivered", false), []);
  assert.deepEqual(selectableTrackingStatuses("Returned", false), []);
  assert.deepEqual(selectableTrackingStatuses("Cancelled", false), []);
});

test("selectableTrackingStatuses never offers Cancelled to couriers", () => {
  for (const status of [null, "Order Created", "Picked Up", "In Transit", "Out for Delivery"]) {
    assert.equal(selectableTrackingStatuses(status, false).includes("Cancelled"), false);
  }
});
