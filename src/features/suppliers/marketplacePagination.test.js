import assert from "node:assert/strict";
import test from "node:test";
import {
  apiPath,
  normalizePage,
  shouldClampPage,
} from "./marketplacePagination.js";

test("apiPath serializes only meaningful list parameters", () => {
  assert.equal(
    apiPath("/api/products", { business_id: 7, q: "rice", page: 2, limit: 25, category_id: "" }),
    "/api/products?business_id=7&q=rice&page=2&limit=25",
  );
});

test("normalizePage keeps paged items and metadata together", () => {
  assert.deepEqual(
    normalizePage({ items: [{ product_id: 3 }], pagination: { page: 2, limit: 10, total_items: 13, total_pages: 2 } }),
    { items: [{ product_id: 3 }], pagination: { page: 2, limit: 10, total_items: 13, total_pages: 2 } },
  );
});

test("shouldClampPage identifies an out-of-range nonempty result", () => {
  assert.equal(shouldClampPage({ page: 3, total_items: 12, total_pages: 2 }), true);
  assert.equal(shouldClampPage({ page: 1, total_items: 0, total_pages: 0 }), false);
});
