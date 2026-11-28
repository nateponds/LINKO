import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_NAV_ITEMS, ROUTE_ACCESS, groupMemberships, defaultPathForSession, hasAccess, redirectPathForRoles, hasMarketplaceMembership, landingPathForUser } from "./roleAccess.js";

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

test("marketplace and inventory routes are closed to admins and operational roles", () => {
  const marketplace = ["/", "/suppliers", "/suppliers/:supplierId", "/orders", "/invoices"];
  for (const path of [...marketplace, "/inventory"]) {
    assert.equal(hasAccess({ global_role: "platform_admin" }, [], ROUTE_ACCESS[path]), false, `admin ${path}`);
    for (const role of ["courier", "logistics_coordinator"]) {
      assert.equal(hasAccess({ user_id: 1 }, [role], ROUTE_ACCESS[path]), false, `${role} ${path}`);
    }
  }
  for (const path of marketplace) {
    for (const role of ["buyer", "wholesaler"]) {
      assert.equal(hasAccess({ user_id: 1 }, [role], ROUTE_ACCESS[path]), true, `${role} ${path}`);
    }
  }
  assert.equal(hasAccess({ user_id: 1 }, ["wholesaler"], ROUTE_ACCESS["/inventory"]), true);
  assert.equal(hasAccess({ user_id: 1 }, ["buyer"], ROUTE_ACCESS["/inventory"]), false);
  // No nav item may point one of these roles at a page that bounces it.
  const adminNav = APP_NAV_ITEMS.filter((item) => hasAccess({ global_role: "platform_admin" }, [], item.roles));
  assert.deepEqual(adminNav.map((item) => item.link), ["/logistics", "/admin"]);
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

test("hasMarketplaceMembership detects trading roles in any business", () => {
  assert.equal(hasMarketplaceMembership([{ business_id: 1, role: "buyer" }]), true);
  assert.equal(hasMarketplaceMembership([{ business_id: 1, role: "courier" }, { business_id: 2, role: "wholesaler" }]), true);
  assert.equal(hasMarketplaceMembership([{ business_id: 1, role: "logistics_coordinator" }]), false);
  assert.equal(hasMarketplaceMembership([]), false);
  assert.equal(hasMarketplaceMembership(), false);
});

test("landing path precedence: platform admin wins, then marketplace, then active role", () => {
  const admin = { user_id: 1, global_role: "platform_admin" };
  // An admin with a marketplace membership still lands on /admin — the same
  // answer every code path must give (redirectPathForRoles says admin wins).
  assert.equal(landingPathForUser(admin, [{ business_id: 1, role: "buyer" }], ["buyer"]), "/admin");
  // Marketplace participants land on home even when their active business is
  // an operational one.
  assert.equal(
    landingPathForUser(
      { user_id: 2 },
      [{ business_id: 1, role: "buyer" }, { business_id: 2, role: "logistics_coordinator" }],
      ["logistics_coordinator"],
    ),
    "/",
  );
  assert.equal(landingPathForUser({ user_id: 3 }, [{ business_id: 1, role: "logistics_coordinator" }], ["logistics_coordinator"]), "/logistics");
  assert.equal(landingPathForUser({ user_id: 4 }, [{ business_id: 1, role: "courier" }], ["courier"]), "/courier");
  // No usable role: the one page every signed-in user can open.
  assert.equal(landingPathForUser({ user_id: 5 }, [], []), "/settings/profile");
});

test("defaultPathForSession gives admins the same landing as the logged-in branch", () => {
  const payload = {
    user: { user_id: 1, global_role: "platform_admin" },
    memberships: [{ business_id: 1, business_name: "Buyer", business_type: "buyer", role: "buyer" }],
  };
  assert.equal(defaultPathForSession(payload, "1"), "/admin");
});
