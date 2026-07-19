import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

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
  return response.setCookie.split(";")[0];
}

function jsonOptions(cookie, method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  };
}

async function createBranch(cookie, stamp, overrides = {}) {
  return request("/api/branches", jsonOptions(cookie, "POST", {
    branch_name: `T08 Branch ${stamp}`,
    contact_number: "+639170008008",
    province: "Cebu",
    city_municipality: "Cebu City",
    barangay: "Lahug",
    street_address: `T08 Street ${stamp}`,
    postal_code: "6000",
    latitude: "10.3283",
    longitude: "123.8988",
    ...overrides,
  }));
}

async function removeBranchFixture(pool, branchId, addressId) {
  if (branchId) {
    await pool.query("DELETE FROM branches WHERE branch_id = $1", [branchId]);
  }
  if (addressId) {
    await pool.query("DELETE FROM addresses WHERE address_id = $1", [addressId]);
  }
}

test("branch create, list, and partial update expose the T08 management shape", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const stamp = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let branchId;
  let addressId;
  let courierId;
  let originalCourierBranch;

  try {
    const created = await createBranch(cookie, stamp);
    assert.equal(created.status, 201);
    branchId = created.body.branch_id;
    addressId = created.body.address_id;
    assert.equal(created.body.latitude, 10.3283);
    assert.equal(created.body.longitude, 123.8988);
    assert.equal(created.body.is_available, true);
    assert.equal(created.body.is_active, true);

    const courier = await pool.query(
      "SELECT courier_id, assigned_branch_id FROM couriers WHERE is_active ORDER BY courier_id LIMIT 1",
    );
    assert.ok(courier.rows[0]);
    courierId = courier.rows[0].courier_id;
    originalCourierBranch = courier.rows[0].assigned_branch_id;
    await pool.query(
      "UPDATE couriers SET assigned_branch_id = $1 WHERE courier_id = $2",
      [branchId, courierId],
    );

    const updated = await request(`/api/branches/${branchId}`, jsonOptions(cookie, "PATCH", {
      branch_name: `T08 Updated ${stamp}`,
      city_municipality: "Mandaue City",
      latitude: 10.3236,
      longitude: 123.9223,
      is_available: false,
    }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.branch_name, `T08 Updated ${stamp}`);
    assert.equal(updated.body.city_municipality, "Mandaue City");
    assert.equal(updated.body.latitude, 10.3236);
    assert.equal(updated.body.longitude, 123.9223);
    assert.equal(updated.body.is_available, false);

    const assigned = await pool.query(
      "SELECT assigned_branch_id FROM couriers WHERE courier_id = $1",
      [courierId],
    );
    assert.equal(
      assigned.rows[0].assigned_branch_id,
      branchId,
      "pausing a branch must not unassign its couriers",
    );

    const resumed = await request(`/api/branches/${branchId}`, jsonOptions(cookie, "PATCH", {
      is_available: true,
    }));
    assert.equal(resumed.status, 200);
    assert.equal(resumed.body.is_available, true);
    assert.equal(resumed.body.latitude, 10.3236);
    assert.equal(resumed.body.longitude, 123.9223);

    const listed = await request("/api/branches", {
      headers: { Cookie: cookie },
    });
    assert.equal(listed.status, 200);
    const row = listed.body.items.find((branch) => branch.branch_id === branchId);
    assert.ok(row);
    assert.equal(row.address_id, addressId);
    assert.equal(row.postal_code, "6000");
    assert.equal(row.latitude, 10.3236);
    assert.equal(row.longitude, 123.9223);
    assert.equal(row.is_available, true);
  } finally {
    if (courierId) {
      await pool.query(
        "UPDATE couriers SET assigned_branch_id = $1 WHERE courier_id = $2",
        [originalCourierBranch, courierId],
      );
    }
    await removeBranchFixture(pool, branchId, addressId);
    await pool.end();
  }
});

test("branch coordinate validation rejects bad pairs and supports explicit unpin", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const stamp = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let branchId;
  let addressId;

  try {
    const created = await createBranch(cookie, stamp);
    assert.equal(created.status, 201);
    branchId = created.body.branch_id;
    addressId = created.body.address_id;

    const oneSided = await request(
      `/api/branches/${branchId}`,
      jsonOptions(cookie, "PATCH", { latitude: 10.4 }),
    );
    assert.equal(oneSided.status, 400);
    assert.match(oneSided.body.error.message, /provided together/);

    const oneSidedNull = await request(
      `/api/branches/${branchId}`,
      jsonOptions(cookie, "PATCH", { latitude: null }),
    );
    assert.equal(oneSidedNull.status, 400);
    assert.match(oneSidedNull.body.error.message, /provided together/);

    const wrongAvailability = await request(
      `/api/branches/${branchId}`,
      jsonOptions(cookie, "PATCH", { is_available: "false" }),
    );
    assert.equal(wrongAvailability.status, 400);
    assert.match(wrongAvailability.body.error.message, /boolean/);

    const unchanged = await pool.query(
      `SELECT latitude::float8 AS latitude, longitude::float8 AS longitude, is_available
         FROM addresses a
         JOIN branches b ON b.address_id = a.address_id
        WHERE b.branch_id = $1`,
      [branchId],
    );
    assert.equal(unchanged.rows[0].latitude, 10.3283);
    assert.equal(unchanged.rows[0].longitude, 123.8988);
    assert.equal(unchanged.rows[0].is_available, true);

    const unpinned = await request(
      `/api/branches/${branchId}`,
      jsonOptions(cookie, "PATCH", { latitude: null, longitude: null }),
    );
    assert.equal(unpinned.status, 200);
    assert.equal(unpinned.body.latitude, null);
    assert.equal(unpinned.body.longitude, null);
  } finally {
    await removeBranchFixture(pool, branchId, addressId);
    await pool.end();
  }
});

test("failed branch metadata update rolls back its address update", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const stamp = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let branchId;
  let addressId;

  try {
    const created = await createBranch(cookie, stamp);
    assert.equal(created.status, 201);
    branchId = created.body.branch_id;
    addressId = created.body.address_id;

    const existing = await pool.query(
      "SELECT branch_name FROM branches WHERE branch_id <> $1 ORDER BY branch_id LIMIT 1",
      [branchId],
    );
    assert.ok(existing.rows[0]);

    const conflicted = await request(
      `/api/branches/${branchId}`,
      jsonOptions(cookie, "PATCH", {
        branch_name: existing.rows[0].branch_name,
        city_municipality: "Should Roll Back",
        latitude: 11.1111,
        longitude: 122.2222,
      }),
    );
    assert.equal(conflicted.status, 400);

    const persisted = await pool.query(
      `SELECT b.branch_name, a.city_municipality,
              a.latitude::float8 AS latitude, a.longitude::float8 AS longitude
         FROM branches b
         JOIN addresses a ON a.address_id = b.address_id
        WHERE b.branch_id = $1`,
      [branchId],
    );
    assert.equal(persisted.rows[0].branch_name, `T08 Branch ${stamp}`);
    assert.equal(persisted.rows[0].city_municipality, "Cebu City");
    assert.equal(persisted.rows[0].latitude, 10.3283);
    assert.equal(persisted.rows[0].longitude, 123.8988);
  } finally {
    await removeBranchFixture(pool, branchId, addressId);
    await pool.end();
  }
});

test("invalid branch creation leaves no orphan address", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const stamp = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const rejected = await createBranch(cookie, stamp, { longitude: undefined });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error.message, /provided together/);

    const address = await pool.query(
      "SELECT 1 FROM addresses WHERE street_address = $1",
      [`T08 Street ${stamp}`],
    );
    assert.equal(address.rowCount, 0);
  } finally {
    await pool.end();
  }
});
