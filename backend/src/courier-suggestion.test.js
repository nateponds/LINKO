import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";
import { suggestLeastLoadedCourierId } from "./services/parcelRouting.js";

// Least-loaded courier suggestion. Rule tests run in a rolled-back
// transaction. The HTTP test commits a private branch so the route can see it,
// then deletes the fixture. Skips without DATABASE_URL, same as app.test.js.
const hasDb = Boolean(process.env.DATABASE_URL);

async function withScenario(fn) {
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

async function createAddress(client) {
  const { rows } = await client.query(
    `INSERT INTO addresses (business_id, province, city_municipality)
     VALUES (NULL, 'Test', 'Suggestville')
     RETURNING address_id`,
  );
  return rows[0].address_id;
}

let seq = 0;
function stamp() {
  seq += 1;
  return `${Date.now().toString(36)}${seq}`;
}

async function createBranch(client) {
  const addressId = await createAddress(client);
  const { rows } = await client.query(
    `INSERT INTO branches (branch_name, address_id, is_active, is_available)
     VALUES ($1, $2, TRUE, TRUE)
     RETURNING branch_id`,
    [`Suggest Branch ${stamp()}`, addressId],
  );
  return rows[0].branch_id;
}

async function createCourier(client, branchId, { active = true } = {}) {
  const { rows } = await client.query(
    `INSERT INTO couriers (full_name, assigned_branch_id, is_active)
     VALUES ($1, $2, $3)
     RETURNING courier_id`,
    [`Suggest Courier ${stamp()}`, branchId, active],
  );
  return rows[0].courier_id;
}

async function createParcel(client, { courierId = null, branchId = null, status = "Order Created" } = {}) {
  const sender = await client.query(
    "SELECT business_id FROM businesses ORDER BY business_id LIMIT 1",
  );
  const receiver = await client.query(
    "SELECT business_id FROM businesses ORDER BY business_id DESC LIMIT 1",
  );
  const origin = await client.query(
    "SELECT address_id FROM addresses WHERE business_id IS NOT NULL ORDER BY address_id LIMIT 1",
  );
  const destination = await client.query(
    "SELECT address_id FROM addresses WHERE business_id IS NOT NULL ORDER BY address_id DESC LIMIT 1",
  );
  const parcelId = `SG${stamp()}`.slice(0, 20);
  await client.query(
    `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                          origin_address_id, destination_address_id, weight_kg)
     VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
    [
      parcelId,
      sender.rows[0].business_id,
      receiver.rows[0].business_id,
      origin.rows[0].address_id,
      destination.rows[0].address_id,
    ],
  );
  await client.query(
    `INSERT INTO tracking_logs (parcel_id, status_update, branch_id, courier_id, scanned_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [parcelId, status, branchId, courierId],
  );
  return parcelId;
}

test("prefers the branch courier with the fewest non-terminal parcels", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const branchId = await createBranch(client);
    const busy = await createCourier(client, branchId);
    const light = await createCourier(client, branchId);
    await createParcel(client, { courierId: busy, branchId, status: "Picked Up" });
    await createParcel(client, { courierId: busy, branchId, status: "Out for Delivery" });
    await createParcel(client, { courierId: light, branchId, status: "Picked Up" });
    // Delivered work does not count, and another branch's idle courier does not compete.
    await createParcel(client, { courierId: light, branchId, status: "Delivered" });
    const elsewhere = await createBranch(client);
    await createCourier(client, elsewhere);
    await createCourier(client, branchId, { active: false });

    assert.equal(await suggestLeastLoadedCourierId(client, branchId), light);
  });
});

test("equal load tie-breaks to the lowest courier id", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const branchId = await createBranch(client);
    const first = await createCourier(client, branchId);
    const second = await createCourier(client, branchId);
    assert.ok(first < second);
    await createParcel(client, { courierId: first, branchId, status: "Picked Up" });
    await createParcel(client, { courierId: second, branchId, status: "Arrived at Branch" });
    await createParcel(client, { courierId: second, branchId, status: "Returned" });
    await createParcel(client, { courierId: second, branchId, status: "Cancelled" });

    assert.equal(await suggestLeastLoadedCourierId(client, branchId), first);
  });
});

test("a single active courier at the branch is still suggested", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const branchId = await createBranch(client);
    const only = await createCourier(client, branchId);
    assert.equal(await suggestLeastLoadedCourierId(client, branchId), only);
  });
});

test("unresolved branch or no active courier suggests nothing", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const branchId = await createBranch(client);
    await createCourier(client, branchId, { active: false });
    assert.equal(await suggestLeastLoadedCourierId(client, branchId), null);
    assert.equal(await suggestLeastLoadedCourierId(client, null), null);
  });
});

async function request(path, options) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();
  await new Promise((resolve) => server.close(resolve));
  return { status: response.status, body: text ? JSON.parse(text) : null, setCookie };
}

test("parcel detail suggests the lighter courier and an explicit assignment wins", { skip: !hasDb }, async () => {
  const pool = createPool();
  const parcelIds = [];
  let branchId;
  let addressId;
  let lightId;
  let busyId;
  try {
    const address = await pool.query(
      `INSERT INTO addresses (business_id, province, city_municipality)
       VALUES (NULL, 'Test', 'Suggestville')
       RETURNING address_id`,
    );
    addressId = address.rows[0].address_id;
    const branch = await pool.query(
      `INSERT INTO branches (branch_name, address_id)
       VALUES ($1, $2)
       RETURNING branch_id`,
      [`Suggest HTTP ${stamp()}`, addressId],
    );
    branchId = branch.rows[0].branch_id;
    const light = await pool.query(
      `INSERT INTO couriers (full_name, assigned_branch_id)
       VALUES ($1, $2) RETURNING courier_id`,
      [`Light ${stamp()}`, branchId],
    );
    const busy = await pool.query(
      `INSERT INTO couriers (full_name, assigned_branch_id)
       VALUES ($1, $2) RETURNING courier_id`,
      [`Busy ${stamp()}`, branchId],
    );
    lightId = light.rows[0].courier_id;
    busyId = busy.rows[0].courier_id;
    assert.ok(lightId < busyId, "insert order keeps the lighter courier id smaller");

    const sender = await pool.query("SELECT business_id FROM businesses ORDER BY business_id LIMIT 1");
    const receiver = await pool.query("SELECT business_id FROM businesses ORDER BY business_id DESC LIMIT 1");
    const origin = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id IS NOT NULL ORDER BY address_id LIMIT 1",
    );
    const destination = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id IS NOT NULL ORDER BY address_id DESC LIMIT 1",
    );

    async function book(courierId, status) {
      const parcelId = `SG${stamp()}`.slice(0, 20);
      await pool.query(
        `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                              origin_address_id, destination_address_id, weight_kg)
         VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
        [
          parcelId,
          sender.rows[0].business_id,
          receiver.rows[0].business_id,
          origin.rows[0].address_id,
          destination.rows[0].address_id,
        ],
      );
      await pool.query(
        `INSERT INTO tracking_logs (parcel_id, status_update, branch_id, courier_id)
         VALUES ($1, $2, $3, $4)`,
        [parcelId, status, branchId, courierId],
      );
      parcelIds.push(parcelId);
      return parcelId;
    }

    await book(busyId, "Picked Up");
    const openId = await book(null, "Order Created");

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "logistics@linko.test", password: "Password123!" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.setCookie.split(";")[0];
    const headers = { Cookie: cookie, "Content-Type": "application/json" };

    const detail = await request(`/api/parcels/${openId}`, { headers });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.latest_courier_id, null);
    assert.equal(detail.body.suggested_courier_id, lightId);

    const options = await request("/api/couriers/options", { headers });
    assert.equal(options.status, 200);
    const lightOption = options.body.find((row) => row.courier_id === lightId);
    const busyOption = options.body.find((row) => row.courier_id === busyId);
    assert.equal(lightOption.active_parcel_count, 0);
    assert.equal(busyOption.active_parcel_count, 1);

    const listed = await request(`/api/couriers?q=${encodeURIComponent(lightOption.full_name)}`, { headers });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.items.find((row) => row.courier_id === lightId).active_parcel_count, 0);

    const explicit = await request(`/api/parcels/${openId}/tracking`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status_update: "Picked Up", courier_id: busyId, branch_id: branchId }),
    });
    assert.equal(explicit.status, 201);
    assert.equal(explicit.body.courier_id, busyId);

    const after = await request(`/api/parcels/${openId}`, { headers });
    assert.equal(after.body.latest_courier_id, busyId);

    const untouched = await book(null, "Order Created");
    const omitted = await request(`/api/parcels/${untouched}/tracking`, {
      method: "POST",
      headers,
      body: JSON.stringify({ status_update: "Picked Up", branch_id: branchId }),
    });
    assert.equal(omitted.status, 201);
    assert.equal(omitted.body.courier_id, null);
  } finally {
    for (const parcelId of parcelIds) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (lightId) await pool.query("DELETE FROM couriers WHERE courier_id = $1", [lightId]);
    if (busyId) await pool.query("DELETE FROM couriers WHERE courier_id = $1", [busyId]);
    if (branchId) await pool.query("DELETE FROM branches WHERE branch_id = $1", [branchId]);
    if (addressId) await pool.query("DELETE FROM addresses WHERE address_id = $1", [addressId]);
    await pool.end();
  }
});
