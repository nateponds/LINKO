import test from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  clampPage,
  paginationRange,
  readListUrlState,
  sanitizeLimit,
  updateListUrlState,
} from "./pagination.js";

test("readListUrlState sanitizes invalid URL values to the supported defaults", () => {
  assert.deepEqual(readListUrlState("?page=zero&limit=99&q=paper"), {
    page: 1,
    limit: 10,
    q: "paper",
  });
  assert.equal(sanitizeLimit("25"), 25);
  assert.equal(sanitizeLimit("50"), 50);
  assert.equal(sanitizeLimit("1"), 10);
});

test("list URL state namespaces pagination keys and preserves unrelated parameters", () => {
  const params = updateListUrlState("?tab=stock&orders_page=4&orders_limit=50", { page: 3 }, { prefix: "inventory" });
  assert.equal(params.toString(), "tab=stock&orders_page=4&orders_limit=50&inventory_page=3");
});

test("query, limit, and filter changes reset only the current list page", () => {
  const queryParams = updateListUrlState("?page=4&limit=25&orders_page=2", { q: " pens " });
  assert.equal(queryParams.toString(), "page=1&limit=25&orders_page=2&q=pens");

  const filterParams = updateListUrlState("?inventory_page=3&tab=all", { filters: { status: "low" } }, { prefix: "inventory" });
  assert.equal(filterParams.toString(), "inventory_page=1&tab=all&status=low");
});

test("pagination ranges clamp out-of-range pages and handle empty results", () => {
  assert.deepEqual(paginationRange({ page: 9, limit: 10, total_items: 23, total_pages: 3 }), {
    start: 21,
    end: 23,
    totalItems: 23,
    page: 3,
    totalPages: 3,
    limit: 10,
  });
  assert.deepEqual(paginationRange({ page: 1, limit: 10, total_items: 0, total_pages: 0 }), {
    start: 0,
    end: 0,
    totalItems: 0,
    page: 1,
    totalPages: 0,
    limit: 10,
  });
});

test("clamp helpers bound page values safely", () => {
  assert.equal(clamp(9, 1, 4), 4);
  assert.equal(clamp(-2, 1, 4), 1);
  assert.equal(clampPage(0, 4), 1);
  assert.equal(clampPage(6, 4), 4);
  assert.equal(clampPage(6, 0), 1);
});
