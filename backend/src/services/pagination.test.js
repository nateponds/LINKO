import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaginatedResponse,
  parsePaginationQuery,
} from "./pagination.js";

test("pagination query defaults to page one and a limit of ten", () => {
  assert.deepEqual(parsePaginationQuery({}), {
    page: 1,
    limit: 10,
    offset: 0,
  });
});

test("pagination query accepts each supported limit", () => {
  for (const limit of [10, 25, 50]) {
    assert.deepEqual(parsePaginationQuery({ page: "2", limit: String(limit) }), {
      page: 2,
      limit,
      offset: limit,
    });
  }
});

test("pagination query trims a nonblank q", () => {
  assert.deepEqual(parsePaginationQuery({ q: "  fresh produce  " }), {
    page: 1,
    limit: 10,
    offset: 0,
    q: "fresh produce",
  });
});

test("pagination query omits a blank q", () => {
  assert.deepEqual(parsePaginationQuery({ q: " \t " }), {
    page: 1,
    limit: 10,
    offset: 0,
  });
});

test("pagination query accepts a q with exactly 100 characters", () => {
  const q = "a".repeat(100);
  assert.equal(parsePaginationQuery({ q }).q, q);
});

test("pagination query rejects q values longer than 100 characters", () => {
  assert.throws(
    () => parsePaginationQuery({ q: "a".repeat(101) }),
    { name: "Error", statusCode: 400 },
  );
});

test("pagination query rejects non-string and duplicate values", () => {
  for (const query of [
    { page: 1 },
    { limit: 10 },
    { q: 1 },
    { page: ["1", "2"] },
    { limit: ["10", "25"] },
    { q: ["tea", "coffee"] },
  ]) {
    assert.throws(() => parsePaginationQuery(query), { statusCode: 400 });
  }
});

test("pagination query rejects invalid page values", () => {
  for (const page of ["0", "-1", "1.5", "1e2", "abc", " 1", "9007199254740992"]) {
    assert.throws(() => parsePaginationQuery({ page }), { statusCode: 400 });
  }
});

test("pagination query rejects unsupported and non-integer limit values", () => {
  for (const limit of ["0", "5", "11", "25.0", "1e1", "abc"]) {
    assert.throws(() => parsePaginationQuery({ limit }), { statusCode: 400 });
  }
});

test("paginated response represents an empty collection", () => {
  assert.deepEqual(buildPaginatedResponse([], { page: 1, limit: 10 }, 0), {
    items: [],
    pagination: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
  });
});

test("paginated response represents a single page", () => {
  assert.deepEqual(buildPaginatedResponse(["one"], { page: 1, limit: 10 }, 1), {
    items: ["one"],
    pagination: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
  });
});

test("paginated response represents multiple pages", () => {
  assert.deepEqual(buildPaginatedResponse(["eleven"], { page: 2, limit: 10 }, 11), {
    items: ["eleven"],
    pagination: { page: 2, limit: 10, total_items: 11, total_pages: 2 },
  });
});

test("paginated response preserves out-of-range page metadata", () => {
  assert.deepEqual(buildPaginatedResponse([], { page: 9, limit: 25 }, 26), {
    items: [],
    pagination: { page: 9, limit: 25, total_items: 26, total_pages: 2 },
  });
});
