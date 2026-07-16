import test from "node:test";
import assert from "node:assert/strict";

import {
  canCourierSubmitTrackingStatus,
  canSubmitTrackingStatus,
  courierAllowedNextStatuses,
} from "./routes/logistics.js";

test("canCourierSubmitTrackingStatus rejects courier cancellation", () => {
  const result = canCourierSubmitTrackingStatus("Out for Delivery", "Cancelled");

  assert.equal(result.allowed, false);
  assert.match(result.message, /cannot cancel/i);
});

test("canCourierSubmitTrackingStatus rejects updates after delivered or returned", () => {
  assert.equal(canCourierSubmitTrackingStatus("Delivered", "Returned").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Delivered", "Delivered").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Returned", "Delivered").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Returned", "Returned").allowed, false);
});

test("transition map allows the forward journey with branch checkpoints", () => {
  assert.equal(canCourierSubmitTrackingStatus("Order Created", "Picked Up").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Picked Up", "Arrived at Branch").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Picked Up", "Out for Delivery").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Departed Branch").allowed, true);
  // Final hub: Arrived can go straight out for delivery, no redundant depart.
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Out for Delivery").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Arrived at Branch").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Out for Delivery").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Delivered").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Delivery Failed").allowed, true);
});

test("transition map rejects moves not on an edge", () => {
  assert.equal(canCourierSubmitTrackingStatus("Order Created", "Out for Delivery").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Picked Up").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Returned").allowed, false);
  // Departed is never terminal -- Returned is not an edge off it, any fail count.
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Returned", 3).allowed, false);
});

test("Delivery Failed edge is count-gated: retry below 3, return leg at 3", () => {
  // fail count < 3 -> retry only
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Out for Delivery", 1).allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Arrived at Branch", 1).allowed, false);

  // 3rd fail recorded -> return leg only; never auto-writes Returned
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Arrived at Branch", 3).allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Out for Delivery", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Returned", 3).allowed, false);
});

test("return leg locks to Out for Return then Returned once fails>=3", () => {
  // Forward journey: no Returned option, only checkpoints / last-mile.
  assert.deepEqual(courierAllowedNextStatuses("Arrived at Branch", 0), ["Departed Branch", "Out for Delivery"]);
  assert.deepEqual(courierAllowedNextStatuses("Arrived at Branch", 2), ["Departed Branch", "Out for Delivery"]);
  // Return leg: branch arrival can only leave for the sender, then complete.
  assert.deepEqual(courierAllowedNextStatuses("Arrived at Branch", 3), ["Out for Return"]);
  assert.deepEqual(courierAllowedNextStatuses("Out for Return", 3), ["Returned"]);
  assert.deepEqual(courierAllowedNextStatuses("Out for Return", 2), []);

  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Out for Return", 3).allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Out for Return", "Returned", 3).allowed, true);

  // Return leg is a trap: no redelivery, no hub departure once fails>=3.
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Out for Delivery", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Departed Branch", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Returned", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Out for Return", "Returned", 2).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Delivery Failed", "Out for Return", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Out for Return", 3).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Out for Return", 2).allowed, false);
});

test("Returned is reachable only from Out for Return on the locked return leg", () => {
  assert.equal(canCourierSubmitTrackingStatus("Out for Return", "Returned", 3).allowed, true);
  // Never directly from a branch arrival.
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Returned", 0).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Returned", 2).allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Arrived at Branch", "Returned", 3).allowed, false);
  // Departing a hub is never terminal -- 'Returned' is not an edge off Departed.
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Returned").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Departed Branch", "Returned", 3).allowed, false);
});

test("canSubmitTrackingStatus binds coordinators to the map, adds only Cancelled", () => {
  // Same checkpoint map as couriers -- no skipping Arrived/Departed.
  assert.equal(canSubmitTrackingStatus("Order Created", "Delivered").allowed, false);
  assert.equal(canSubmitTrackingStatus("Picked Up", "Departed Branch").allowed, false);
  assert.equal(canSubmitTrackingStatus("Arrived at Branch", "Departed Branch").allowed, true);

  // The one privileged-exclusive move: Cancelled from any non-terminal status.
  assert.equal(canSubmitTrackingStatus("Order Created", "Cancelled").allowed, true);
  assert.equal(canSubmitTrackingStatus("Out for Delivery", "Cancelled").allowed, true);
  assert.equal(canSubmitTrackingStatus("Delivered", "Cancelled").allowed, false);

  // Count-gated Delivery Failed edge applies to coordinators too.
  assert.equal(canSubmitTrackingStatus("Delivery Failed", "Arrived at Branch", 3).allowed, true);
  assert.equal(canSubmitTrackingStatus("Delivery Failed", "Arrived at Branch", 1).allowed, false);
});

test("courierAllowedNextStatuses matches the map and gates on fail count", () => {
  assert.deepEqual(courierAllowedNextStatuses("Out for Delivery"), ["Delivered", "Delivery Failed"]);
  assert.deepEqual(courierAllowedNextStatuses("Delivery Failed", 2), ["Out for Delivery"]);
  assert.deepEqual(courierAllowedNextStatuses("Delivery Failed", 3), ["Arrived at Branch"]);
  assert.deepEqual(courierAllowedNextStatuses("Arrived at Branch", 3), ["Out for Return"]);
  assert.deepEqual(courierAllowedNextStatuses("Out for Return", 3), ["Returned"]);
  assert.deepEqual(courierAllowedNextStatuses("Delivered"), []);
  assert.equal(courierAllowedNextStatuses(null).includes("Cancelled"), false);
});
