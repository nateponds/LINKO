import test from "node:test";
import assert from "node:assert/strict";

import { trackingLocationText } from "./trackingTimeline.js";

const parcel = {
  destination_address: {
    street_address: "Lahug Office",
    barangay: "Lahug",
    city_municipality: "Cebu City",
    province: "Cebu",
  },
};

test("trackingLocationText describes branch as handling branch", () => {
  assert.equal(
    trackingLocationText({ status_update: "Departed Branch", branch_name: "LINKO Cebu Central Hub" }, parcel),
    "handled by LINKO Cebu Central Hub",
  );
});

test("trackingLocationText does not show a branch for delivery attempts", () => {
  assert.equal(
    trackingLocationText({ status_update: "Out for Delivery", branch_name: "LINKO Cebu Central Hub" }, parcel),
    "",
  );
  assert.equal(
    trackingLocationText({ status_update: "Delivery Failed", branch_name: "LINKO Cebu Central Hub" }, parcel),
    "",
  );
});

test("trackingLocationText describes delivered events by destination", () => {
  assert.equal(
    trackingLocationText({ status_update: "Delivered", branch_name: "LINKO Cebu Central Hub" }, parcel),
    "delivered to Lahug Office, Lahug, Cebu City, Cebu",
  );
});

test("trackingLocationText distinguishes missing branch records", () => {
  assert.equal(
    trackingLocationText({ status_update: "Picked Up", branch_name: null }, parcel),
    "branch not recorded",
  );
});
