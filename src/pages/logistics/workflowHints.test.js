import assert from "node:assert/strict";
import test from "node:test";
import { courierActionCue, formatNextStatuses, nextStatusesForRole } from "./workflowHints.js";

test("coordinators see the courier next statuses plus Cancelled", () => {
  assert.deepEqual(nextStatusesForRole("Order Created", false, true), ["Picked Up", "Cancelled"]);
  assert.deepEqual(nextStatusesForRole("Delivered", false, true), []);
});

test("couriers cannot cancel and follow the return leg", () => {
  assert.deepEqual(nextStatusesForRole("Out for Delivery", false, false), ["Delivered", "Delivery Failed"]);
  assert.deepEqual(nextStatusesForRole("Delivery Failed", true, false), ["Arrived at Branch"]);
  assert.match(courierActionCue("Delivery Failed", true), /return leg/i);
  assert.equal(formatNextStatuses([]), "Finished — no further status");
});
