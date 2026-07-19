import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminListPath } from "./adminPagination.js";

test("buildAdminListPath sends the current page, limit, and non-empty search", () => {
  assert.equal(
    buildAdminListPath("/api/admin/users", { page: 3, limit: 25, q: "  jane  " }),
    "/api/admin/users?page=3&limit=25&q=jane",
  );
});

test("buildAdminListPath omits an empty search term", () => {
  assert.equal(
    buildAdminListPath("/api/admin/businesses", { page: 1, limit: 10, q: "   " }),
    "/api/admin/businesses?page=1&limit=10",
  );
});
