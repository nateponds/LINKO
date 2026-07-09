import test from "node:test";
import assert from "node:assert/strict";

import { canCourierSubmitTrackingStatus } from "./routes/logistics.js";

test("canCourierSubmitTrackingStatus rejects courier cancellation", () => {
  const result = canCourierSubmitTrackingStatus("Out for Delivery", "Cancelled");

  assert.equal(result.allowed, false);
  assert.match(result.message, /cannot cancel/i);
});

test("canCourierSubmitTrackingStatus rejects courier backtracking", () => {
  const result = canCourierSubmitTrackingStatus("Out for Delivery", "Picked Up");

  assert.equal(result.allowed, false);
  assert.match(result.message, /backward/i);
});

test("canCourierSubmitTrackingStatus rejects updates after delivered or returned", () => {
  assert.equal(canCourierSubmitTrackingStatus("Delivered", "Returned").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Delivered", "Delivered").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Returned", "Delivered").allowed, false);
  assert.equal(canCourierSubmitTrackingStatus("Returned", "Returned").allowed, false);
});

test("canCourierSubmitTrackingStatus allows forward courier movement and terminal outcomes", () => {
  assert.equal(canCourierSubmitTrackingStatus("Picked Up", "In Transit").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Delivered").allowed, true);
  assert.equal(canCourierSubmitTrackingStatus("Out for Delivery", "Returned").allowed, true);
});
