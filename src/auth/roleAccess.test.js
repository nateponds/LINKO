import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_NAV_ITEMS, ROUTE_ACCESS, groupMemberships, defaultPathForSession, hasAccess, redirectPathForRoles } from "./roleAccess.js";

const PUBLIC_PATHS = new Set(["/landing", "/login", "/register", "*"]);

test("every routed path is guarded by its own ROUTE_ACCESS entry", async () => {
  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  const guarded = [...app.matchAll(/guarded\("([^"]+)"/g)].map((m) => m[1]);
  const plain = [...app.matchAll(/<Route path="(\/[^"]*|\*)"/g)].map((m) => m[1]);

  assert.ok(guarded.length > 0);
  for (const path of guarded) {
    assert.ok(ROUTE_ACCESS[path], `${path} has no ROUTE_ACCESS entry`);
  }
  for (const path of plain) {
    assert.ok(
      PUBLIC_PATHS.has(path) || ROUTE_ACCESS[path],
      `${path} is routed without a guard`,
    );
  }
});

test("nav links use the exact role list of the route they open", () => {
  for (const item of APP_NAV_ITEMS) {
    assert.equal(item.roles, ROUTE_ACCESS[item.link], item.link);
  }
});

test("courier dashboard is courier-only (no inherited logistics guard)", () => {
  assert.deepEqual(ROUTE_ACCESS["/courier"], ["courier"]);
});

test("the no-role fallback is a page every signed-in user can open", () => {
  const fallback = redirectPathForRoles([], false);
  assert.equal(fallback, "/settings/profile");
  assert.equal(hasAccess({ user_id: 1 }, [], ROUTE_ACCESS["/settings"]), true);
});

test("admin passes only where the list names platform_admin", () => {
  const admin = { global_role: "platform_admin" };
  assert.equal(hasAccess(admin, [], ROUTE_ACCESS["/admin"]), true);
  assert.equal(hasAccess(admin, [], ROUTE_ACCESS["/dashboard"]), false);
  assert.equal(hasAccess(admin, [], ROUTE_ACCESS["/courier"]), false);
});

test("only the active business's roles count", () => {
  const user = { user_id: 1 };
  assert.equal(hasAccess(user, ["buyer"], ROUTE_ACCESS["/dashboard"]), false);
  assert.equal(hasAccess(user, ["wholesaler"], ROUTE_ACCESS["/dashboard"]), true);
});

test("add business is available to buyers and wholesalers, not admins or operational roles", () => {
  for (const role of ["buyer", "wholesaler"]) {
    assert.equal(hasAccess({ user_id: 1 }, [role], ROUTE_ACCESS["/businesses/new"]), true);
  }
  for (const role of ["courier", "logistics_coordinator"]) {
    assert.equal(hasAccess({ user_id: 1 }, [role], ROUTE_ACCESS["/businesses/new"]), false);
  }
  assert.equal(hasAccess({ global_role: "platform_admin" }, [], ROUTE_ACCESS["/businesses/new"]), false);
});

test("additional businesses remain separate switcher options and select their own capabilities", () => {
  const memberships = [
    { business_id: 1, business_name: "Buyer", business_type: "buyer", role: "buyer" },
    { business_id: 2, business_name: "Seller", business_type: "wholesaler", role: "wholesaler" },
    { business_id: 3, business_name: "Second seller", business_type: "wholesaler", role: "wholesaler" },
  ];
  assert.equal(groupMemberships(memberships.slice(0, 1)).length, 1);
  assert.equal(groupMemberships(memberships.slice(0, 2)).length, 2);
  const businesses = groupMemberships(memberships);
  assert.equal(businesses.length, 3);
  for (const business of businesses) {
    assert.equal(hasAccess({ user_id: 1 }, business.roles, ROUTE_ACCESS["/dashboard"]), business.business_type === "wholesaler");
    assert.equal(defaultPathForSession({ memberships }, String(business.business_id)), "/");
  }
});
