import assert from "node:assert/strict";
import test from "node:test";
import { buildLogisticsListPath } from "./logisticsPagination.js";

test("buildLogisticsListPath keeps a courier search scoped to its endpoint", () => {
  assert.equal(
    buildLogisticsListPath("/api/couriers", { page: 2, limit: 50, q: "van" }),
    "/api/couriers?page=2&limit=50&q=van",
  );
});
