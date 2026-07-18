import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 13 T02: canonical business locations schema (migration 023).
// DB-backed tests skip without DATABASE_URL, same as app.test.js.
const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, options) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  await new Promise((resolve) => server.close(resolve));
  return { body, status: response.status };
}

// Runs fn on a client inside a transaction that always rolls back, so
// constraint probes never leave rows behind.
async function withRollback(fn) {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
}

async function insertAddress(client, latitude, longitude) {
  return client.query(
    `INSERT INTO addresses (business_id, province, city_municipality, latitude, longitude)
     VALUES (NULL, 'Test', 'Testville', $1, $2)`,
    [latitude, longitude],
  );
}

test("addresses accept a valid coordinate pair and a fully unpinned row", { skip: !hasDb }, async () => {
  await withRollback(async (client) => {
    await insertAddress(client, 10.3283, 123.8988);
    await insertAddress(client, null, null);
  });
});

test("addresses reject a lone latitude or longitude", { skip: !hasDb }, async () => {
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, 10.3283, null), /addresses_coords_paired/);
  });
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, null, 123.8988), /addresses_coords_paired/);
  });
});

test("addresses reject out-of-range coordinates", { skip: !hasDb }, async () => {
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, 90.1, 123.8988), /addresses_latitude_range/);
  });
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, -90.1, 123.8988), /addresses_latitude_range/);
  });
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, 10.3283, 180.1), /addresses_longitude_range/);
  });
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, 10.3283, -180.1), /addresses_longitude_range/);
  });
});

test("addresses reject exact (0,0) but allow a single zero coordinate", { skip: !hasDb }, async () => {
  await withRollback(async (client) => {
    await assert.rejects(insertAddress(client, 0, 0), /addresses_no_null_island/);
  });
  await withRollback(async (client) => {
    await insertAddress(client, 0, 123.8988);
    await insertAddress(client, 10.3283, 0);
  });
});

test("parcel_route_stops PK rejects a duplicate (parcel_id, stop_order)", { skip: !hasDb }, async () => {
  await withRollback(async (client) => {
    const insertStop = () =>
      client.query(
        `INSERT INTO parcel_route_stops (parcel_id, stop_order, stop_type, label)
         VALUES ('LKO-00000001', 1, 'origin', 'Test origin')`,
      );
    await insertStop();
    await assert.rejects(insertStop, /parcel_route_stops_pkey/);
    // duplicate violation aborts the transaction; nothing else to assert here
  });
});

test("registration points logistics_address_id at the placeholder address", { skip: !hasDb }, async () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `pin-${stamp}@linko.test`,
      password: "Password123!",
      full_name: "Pin Test",
      business_name: `Pin Test Business ${stamp}`,
      business_type: "buyer",
    }),
  });
  assert.equal(response.status, 201);
  const businessId = response.body.memberships[0].business_id;

  const pool = createPool();
  try {
    const { rows } = await pool.query(
      `SELECT b.logistics_address_id, a.business_id AS address_owner,
              a.province, a.latitude, a.longitude
         FROM businesses b
         JOIN addresses a ON a.address_id = b.logistics_address_id
        WHERE b.business_id = $1`,
      [businessId],
    );
    assert.ok(rows[0], "expected logistics_address_id to be set at registration");
    assert.equal(rows[0].address_owner, businessId);
    assert.equal(rows[0].province, "Not provided");
    // placeholder is unpinned: the new business must hit the pin gates
    assert.equal(rows[0].latitude, null);
    assert.equal(rows[0].longitude, null);
  } finally {
    await pool.end();
  }
});

test("seed pins every marketplace business, wholesalers at their warehouse", { skip: !hasDb }, async () => {
  const pool = createPool();
  try {
    const unpinned = await pool.query(
      `SELECT b.business_name
         FROM businesses b
         LEFT JOIN addresses a ON a.address_id = b.logistics_address_id
        WHERE b.business_type IN ('buyer', 'wholesaler')
          AND b.business_name LIKE ANY (ARRAY[
                'Sunrise Retail%', 'Cebu Fresh%', 'Davao Sari-Sari%',
                'Mandaue Agri%', 'Metro Cebu Trading%'])
          AND (a.latitude IS NULL OR a.longitude IS NULL)`,
    );
    assert.deepEqual(unpinned.rows, [], "seeded marketplace businesses must have pinned coordinates");

    const wholesalers = await pool.query(
      `SELECT b.business_name, b.logistics_address_id, w.address_id AS warehouse_address_id
         FROM businesses b
         JOIN warehouses w ON w.business_id = b.business_id
        WHERE b.business_type = 'wholesaler'`,
    );
    assert.ok(wholesalers.rowCount >= 3, "expected the seeded wholesalers");
    for (const row of wholesalers.rows) {
      assert.equal(
        row.logistics_address_id,
        row.warehouse_address_id,
        `${row.business_name} must be pinned at its warehouse address`,
      );
    }
  } finally {
    await pool.end();
  }
});

test("seed gives every branch address coordinates and available branches", { skip: !hasDb }, async () => {
  const pool = createPool();
  try {
    const { rows } = await pool.query(
      `SELECT br.branch_name, br.is_available, a.latitude, a.longitude
         FROM branches br
         JOIN addresses a ON a.address_id = br.address_id
        WHERE br.branch_name LIKE 'LINKO%Hub'`,
    );
    assert.ok(rows.length >= 2, "expected the seeded hubs");
    for (const row of rows) {
      assert.equal(row.is_available, true);
      assert.ok(row.latitude !== null && row.longitude !== null, `${row.branch_name} must be pinned`);
    }
  } finally {
    await pool.end();
  }
});
