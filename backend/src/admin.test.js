import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

// DB-backed, so gated the same way as app.test.js.
const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, options) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  await new Promise((resolve) => server.close(resolve));

  return { body, status: response.status, setCookie };
}

async function loginAs(email, password = "Password123!") {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(response.status, 200);
  assert.match(response.setCookie, /linko_session=/);

  return response.setCookie.split(";")[0];
}

async function getBusinessIdByName(pool, businessName) {
  const { rows } = await pool.query(
    "SELECT business_id FROM businesses WHERE business_name = $1",
    [businessName],
  );
  assert.ok(rows[0], `expected business ${businessName} to exist`);
  return rows[0].business_id;
}

test("admin users list is rejected for unauthenticated requests", async () => {
  const response = await request("/api/admin/users");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("non-admin cannot reach the admin console", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const response = await request("/api/admin/users", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error.message, /forbidden/i);
});

test("admin lists users with aggregated memberships", { skip: !hasDb }, async () => {
  const cookie = await loginAs("admin@linko.test");
  const response = await request("/api/admin/users?q=wholesaler%40linko.test", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.items));
  const wholesaler = response.body.items.find((u) => u.email === "wholesaler@linko.test");
  assert.ok(wholesaler, "expected the seeded wholesaler in the list");
  assert.ok("is_active" in wholesaler);
  assert.ok(Array.isArray(wholesaler.memberships));
  assert.ok(wholesaler.memberships.some((m) => m.role === "wholesaler"));
});

test("admin creates a courier user who can then log in", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const email = `courier-created-${Date.now()}@example.com`;

  try {
    const branch = await pool.query(
      "SELECT branch_id FROM branches WHERE is_active ORDER BY branch_id LIMIT 1",
    );
    const branchId = branch.rows[0].branch_id;

    // No business_id: the server attaches couriers to the canonical org.
    const created = await request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        full_name: "Created Courier",
        email,
        password: "Password123!",
        kind: "courier",
        phone_number: "+639170001234",
        vehicle_type: "Motorcycle",
        assigned_branch_id: branchId,
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.email, email);
    assert.equal(created.body.global_role, null);

    // The linked couriers row carries the logistics fields sent above.
    const courierRow = await pool.query(
      "SELECT phone_number, vehicle_type, assigned_branch_id FROM couriers WHERE user_id = $1",
      [created.body.user_id],
    );
    assert.equal(courierRow.rowCount, 1);
    assert.equal(courierRow.rows[0].phone_number, "+639170001234");
    assert.equal(courierRow.rows[0].vehicle_type, "Motorcycle");
    assert.equal(courierRow.rows[0].assigned_branch_id, branchId);

    // Newly created privileged user can authenticate, and the membership
    // landed on the canonical logistics org.
    const cookie = await loginAs(email);
    const me = await request("/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.ok(
      me.body.memberships.some(
        (m) => m.role === "courier" && m.business_name === "LINKO Logistics",
      ),
      "courier membership should land on LINKO Logistics",
    );

    // Duplicate email -> 409.
    const dup = await request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        full_name: "Created Courier",
        email,
        password: "Password123!",
        kind: "courier",
      }),
    });
    assert.equal(dup.status, 409);
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
    await pool.end();
  }
});

test("courier create ignores a client-sent business_id", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const email = `courier-stray-biz-${Date.now()}@example.com`;

  try {
    // A wholesaler business: if the server trusted this, the courier's
    // membership would land on it instead of the canonical logistics org.
    const wholesalerId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");

    const created = await request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        full_name: "Stray Business Courier",
        email,
        password: "Password123!",
        kind: "courier",
        business_id: wholesalerId,
      }),
    });
    assert.equal(created.status, 201);

    const membership = await pool.query(
      `SELECT b.business_name
         FROM business_memberships bm
         JOIN businesses b ON b.business_id = bm.business_id
        WHERE bm.user_id = $1 AND bm.role = 'courier'`,
      [created.body.user_id],
    );
    assert.equal(membership.rowCount, 1);
    assert.equal(membership.rows[0].business_name, "LINKO Logistics");
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
    await pool.end();
  }
});

test("courier create rejects an inactive/unknown branch", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const email = `bad-branch-${Date.now()}@example.com`;

  try {
    const harborId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const response = await request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        full_name: "Bad Branch Courier",
        email,
        password: "Password123!",
        kind: "courier",
        business_id: harborId,
        assigned_branch_id: 999999,
      }),
    });

    assert.equal(response.status, 400);
    assert.match(response.body.error.message, /active branch/i);

    // Nothing was created (transaction rolled back).
    const users = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    assert.equal(users.rowCount, 0);
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
    await pool.end();
  }
});

test("admin deactivation blocks login and reactivation restores it", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const email = `deactivate-${Date.now()}@example.com`;

  try {
    const harborId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const created = await request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        full_name: "Deactivate Me",
        email,
        password: "Password123!",
        kind: "logistics_coordinator",
        business_id: harborId,
      }),
    });
    assert.equal(created.status, 201);
    const userId = created.body.user_id;

    // Works before deactivation.
    await loginAs(email);

    const deactivated = await request(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ is_active: false }),
    });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.is_active, false);

    // Login now rejected, indistinguishable from bad credentials.
    const blocked = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Password123!" }),
    });
    assert.equal(blocked.status, 401);
    assert.match(blocked.body.error.message, /invalid email or password/i);

    // Reactivate and confirm login works again.
    const reactivated = await request(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ is_active: true }),
    });
    assert.equal(reactivated.status, 200);
    assert.equal(reactivated.body.is_active, true);
    await loginAs(email);
  } finally {
    await pool.query("DELETE FROM users WHERE email = $1", [email]);
    await pool.end();
  }
});

test("admin toggles business verification", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let businessId;

  try {
    const inserted = await pool.query(
      `INSERT INTO businesses (business_name, business_type, is_verified)
       VALUES ($1, 'wholesaler', FALSE) RETURNING business_id`,
      [`Verify Toggle Co ${Date.now()}`],
    );
    businessId = inserted.rows[0].business_id;

    const listed = await request("/api/admin/businesses", {
      headers: { Cookie: adminCookie },
    });
    assert.equal(listed.status, 200);
    assert.ok(listed.body.items.some((b) => b.business_id === businessId));

    const verified = await request(`/api/admin/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ is_verified: true }),
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.is_verified, true);

    const unverified = await request(`/api/admin/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ is_verified: false }),
    });
    assert.equal(unverified.status, 200);
    assert.equal(unverified.body.is_verified, false);
  } finally {
    if (businessId) {
      await pool.query("DELETE FROM businesses WHERE business_id = $1", [businessId]);
    }
    await pool.end();
  }
});
