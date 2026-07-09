import test from "node:test";
import assert from "node:assert/strict";

import { selectableTrackingStatuses } from "./statusWorkflow.js";

test("selectableTrackingStatuses hides completed phases from couriers", () => {
  assert.deepEqual(selectableTrackingStatuses("Out for Delivery", false), [
    "Out for Delivery",
    "Delivered",
    "Returned",
    "Cancelled",
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
  assert.deepEqual(selectableTrackingStatuses("Delivered", false), ["Delivered"]);
});
