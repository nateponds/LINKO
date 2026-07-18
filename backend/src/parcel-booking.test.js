import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 13 T05: standalone parcel booking — ownership validation, pin
// gates, server-computed distance, shared resolver, route snapshots.
// Sprint 13 T07 (bottom of file): late branch assignment snapshots.
// DB-backed tests skip without DATABASE_URL, same as app.test.js.
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

function bookParcel(cookie, overrides = {}) {
  // Defaults: Cebu Fresh (business 2) warehouse addr 3 -> Sunrise (business 1) addr 1
  return request("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      sender_id: 2,
      receiver_id: 1,
      tier_id: 1,
      origin_address_id: 3,
      destination_address_id: 1,
      weight_kg: 2,
      payment_method: "Prepaid",
      ...overrides,
    }),
  });
}

// Same formula as services/location.js haversineKmSql, for expected values.
function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const arg =
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2) - rad(lng1)) +
    Math.sin(rad(lat1)) * Math.sin(rad(lat2));
  return 6371 * Math.acos(Math.min(1, Math.max(-1, arg)));
}

async function withPool(fn) {
  const pool = createPool();
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

const countParcels = (pool) =>
  pool.query("SELECT COUNT(*)::int AS n FROM parcels").then(({ rows }) => rows[0].n);

async function registerBusiness(businessType) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `t05-${stamp}@linko.test`,
      password: "Password123!",
      full_name: "T05 Test",
      business_name: `T05 ${businessType} ${stamp}`,
      business_type: businessType,
    }),
  });
  assert.equal(response.status, 201);
  const businessId = response.body.memberships[0].business_id;
  const addressId = await withPool(async (pool) => {
    const { rows } = await pool.query(
      "SELECT logistics_address_id FROM businesses WHERE business_id = $1",
      [businessId],
    );
    return rows[0].logistics_address_id;
  });
  return { businessId, addressId };
}

test("booking computes server distance, fee, branch, and a 3-stop snapshot", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  // client-supplied distance must be ignored
  const response = await bookParcel(cookie, { total_distance_km: 9999 });
  assert.equal(response.status, 201);
  assert.equal(response.body.current_status, "Order Created");
  const parcelId = response.body.parcel_id;

  const expectedKm = haversineKm(10.3444, 123.9137, 10.3283, 123.8988);
  await withPool(async (pool) => {
    const parcel = await pool.query(
      `SELECT total_distance_km::float8 AS distance_km, shipping_fee::float8 AS fee
         FROM parcels WHERE parcel_id = $1`,
      [parcelId],
    );
    const { distance_km, fee } = parcel.rows[0];
    assert.ok(Math.abs(distance_km - expectedKm) < 0.01, `server distance, got ${distance_km}`);
    // tier 1: 50 base + 2kg x 20 + km x 2
    assert.ok(Math.abs(fee - (50 + 40 + distance_km * 2)) < 0.05, `fee from server distance, got ${fee}`);

    const log = await pool.query(
      `SELECT branch_id FROM tracking_logs WHERE parcel_id = $1 ORDER BY log_id`,
      [parcelId],
    );
    assert.equal(log.rows.length, 1);
    assert.equal(log.rows[0].branch_id, 1, "warehouse addr 3 is nearest the Cebu hub");

    const stops = await pool.query(
      `SELECT stop_order, stop_type, branch_id, label,
              latitude::float8 AS latitude, longitude::float8 AS longitude
         FROM parcel_route_stops WHERE parcel_id = $1 ORDER BY stop_order`,
      [parcelId],
    );
    assert.equal(stops.rows.length, 3, "snapshot is exactly 3 stops");
    const [origin, branch, destination] = stops.rows;
    assert.deepEqual(
      [origin.stop_type, branch.stop_type, destination.stop_type],
      ["origin", "branch", "destination"],
    );
    assert.equal(origin.label, "Cebu Fresh Wholesale");
    assert.equal(origin.latitude, 10.3444);
    assert.equal(origin.branch_id, null);
    assert.equal(branch.branch_id, 1);
    assert.equal(branch.label, "LINKO Cebu Central Hub");
    assert.equal(destination.label, "Sunrise Retail Cooperative");
    assert.equal(destination.longitude, 123.8988);
    assert.equal(destination.branch_id, null);
  });
});

test("parcel detail returns planned_route separately from tracking_history", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const booked = await bookParcel(cookie);
  assert.equal(booked.status, 201);

  const detail = await request(`/api/parcels/${booked.body.parcel_id}`, {
    headers: { Cookie: cookie },
  });

  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.planned_route, [
    {
      stop_order: 1,
      stop_type: "origin",
      branch_id: null,
      label: "Cebu Fresh Wholesale",
      latitude: 10.3444,
      longitude: 123.9137,
    },
    {
      stop_order: 2,
      stop_type: "branch",
      branch_id: 1,
      label: "LINKO Cebu Central Hub",
      latitude: 10.3243,
      longitude: 123.9234,
    },
    {
      stop_order: 3,
      stop_type: "destination",
      branch_id: null,
      label: "Sunrise Retail Cooperative",
      latitude: 10.3283,
      longitude: 123.8988,
    },
  ]);
  assert.ok(
    detail.body.tracking_history.every(
      (entry) => !("stop_order" in entry) && !("stop_type" in entry),
    ),
    "planned stops never leak into tracking history",
  );
});

test("foreign origin and destination address IDs are rejected with 400", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const before = await withPool(countParcels);

  const foreignOrigin = await bookParcel(cookie, { origin_address_id: 1 }); // belongs to business 1
  assert.equal(foreignOrigin.status, 400);
  assert.match(foreignOrigin.body.error.message, /origin_address_id/);

  const foreignDestination = await bookParcel(cookie, { destination_address_id: 2 }); // belongs to business 2
  assert.equal(foreignDestination.status, 400);
  assert.match(foreignDestination.body.error.message, /destination_address_id/);

  const ownerlessOrigin = await bookParcel(cookie, { origin_address_id: 12 }); // business_id NULL
  assert.equal(ownerlessOrigin.status, 400);

  assert.equal(await withPool(countParcels), before, "nothing persisted on rejection");
});

test("unpinned origin or destination is gated with the contracted 409", { skip: !hasDb }, async () => {
  const coordinator = await loginAs("logistics@linko.test");
  const wholesaler = await registerBusiness("wholesaler");
  const buyer = await registerBusiness("buyer");
  const before = await withPool(countParcels);

  // coordinator may book on behalf of any sender business
  const unpinnedOrigin = await bookParcel(coordinator, {
    sender_id: wholesaler.businessId,
    origin_address_id: wholesaler.addressId,
  });
  assert.equal(unpinnedOrigin.status, 409);
  assert.equal(
    unpinnedOrigin.body.error.message,
    "Origin and destination addresses must have coordinates before booking",
  );

  const unpinnedDestination = await bookParcel(coordinator, {
    receiver_id: buyer.businessId,
    destination_address_id: buyer.addressId,
  });
  assert.equal(unpinnedDestination.status, 409);

  assert.equal(await withPool(countParcels), before, "409 rolls back the whole booking");
});

test("assignment miss keeps the booking: branchless parcel, no snapshot", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  await withPool(async (pool) => {
    await pool.query("UPDATE branches SET is_available = false");
    try {
      const response = await bookParcel(cookie);
      assert.equal(response.status, 201, "assignment miss never fails parcel creation");
      const parcelId = response.body.parcel_id;

      const log = await pool.query(
        "SELECT branch_id FROM tracking_logs WHERE parcel_id = $1",
        [parcelId],
      );
      assert.equal(log.rows[0].branch_id, null);

      const stops = await pool.query(
        "SELECT COUNT(*)::int AS n FROM parcel_route_stops WHERE parcel_id = $1",
        [parcelId],
      );
      assert.equal(stops.rows[0].n, 0, "branchless parcel gets no snapshot yet");

      const detail = await request(`/api/parcels/${parcelId}`, {
        headers: { Cookie: cookie },
      });
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body.planned_route, []);

      const parcel = await pool.query(
        "SELECT total_distance_km::float8 AS distance_km FROM parcels WHERE parcel_id = $1",
        [parcelId],
      );
      assert.ok(parcel.rows[0].distance_km > 0, "distance is priced even without a branch");
    } finally {
      await pool.query("UPDATE branches SET is_available = true");
    }
  });
});

// --- Sprint 13 T07: late branch assignment snapshots (§8.3) ---

function postTracking(cookie, parcelId, body) {
  return request(`/api/parcels/${parcelId}/tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

const readStops = (pool, parcelId) =>
  pool
    .query(
      `SELECT stop_order, stop_type, branch_id, label,
              latitude::float8 AS latitude, longitude::float8 AS longitude
         FROM parcel_route_stops WHERE parcel_id = $1 ORDER BY stop_order`,
      [parcelId],
    )
    .then(({ rows }) => rows);

test("first non-null branch scan snapshots a branchless parcel; retries stay idempotent", { skip: !hasDb }, async () => {
  const wholesaler = await loginAs("wholesaler@linko.test");
  let parcelId;
  await withPool(async (pool) => {
    // sideline all branches so the booking resolver misses -> branchless, no snapshot
    await pool.query("UPDATE branches SET is_available = false");
    try {
      const booked = await bookParcel(wholesaler);
      assert.equal(booked.status, 201);
      parcelId = booked.body.parcel_id;
    } finally {
      await pool.query("UPDATE branches SET is_available = true");
    }
    assert.equal((await readStops(pool, parcelId)).length, 0, "branchless booking has no snapshot");
  });

  const coordinator = await loginAs("logistics@linko.test");

  // a scan that still carries no branch must not snapshot
  const pickedUp = await postTracking(coordinator, parcelId, { status_update: "Picked Up" });
  assert.equal(pickedUp.status, 201);
  await withPool(async (pool) => {
    assert.equal((await readStops(pool, parcelId)).length, 0, "null-branch scan never snapshots");
  });

  // first non-null branch -> exactly one 3-stop plan built around THAT branch
  const assigned = await postTracking(coordinator, parcelId, {
    status_update: "Arrived at Branch",
    branch_id: 2,
  });
  assert.equal(assigned.status, 201);
  const snapshot = await withPool(async (pool) => {
    const stops = await readStops(pool, parcelId);
    assert.equal(stops.length, 3, "late assignment creates exactly one 3-stop plan");
    const [origin, branch, destination] = stops;
    assert.deepEqual(
      [origin.stop_type, branch.stop_type, destination.stop_type],
      ["origin", "branch", "destination"],
    );
    assert.equal(origin.label, "Cebu Fresh Wholesale");
    assert.equal(origin.latitude, 10.3444);
    assert.equal(branch.branch_id, 2, "plan uses the assigned branch, not the resolver's pick");
    assert.equal(branch.label, "LINKO Mandaue Hub");
    assert.equal(destination.label, "Sunrise Retail Cooperative");
    assert.equal(destination.longitude, 123.8988);
    return stops;
  });

  // retry-shaped scan (branch 2 carried forward) re-runs the hook; plan must not change
  const retry = await postTracking(coordinator, parcelId, { status_update: "Departed Branch" });
  assert.equal(retry.status, 201);
  await withPool(async (pool) => {
    assert.deepEqual(await readStops(pool, parcelId), snapshot, "existing plan is never rewritten");
  });
});

test("reassignment and hub transfers never mutate an existing plan", { skip: !hasDb }, async () => {
  const wholesaler = await loginAs("wholesaler@linko.test");
  // normal booking: resolver assigns branch 1 and snapshots at creation
  const booked = await bookParcel(wholesaler);
  assert.equal(booked.status, 201);
  const parcelId = booked.body.parcel_id;

  const original = await withPool((pool) => readStops(pool, parcelId));
  assert.equal(original.length, 3);
  assert.equal(original[1].branch_id, 1);

  const coordinator = await loginAs("logistics@linko.test");
  const reassigned = await postTracking(coordinator, parcelId, {
    status_update: "Picked Up",
    branch_id: 2,
  });
  assert.equal(reassigned.status, 201);
  const transferred = await postTracking(coordinator, parcelId, {
    status_update: "Arrived at Branch",
    branch_id: 2,
  });
  assert.equal(transferred.status, 201);

  await withPool(async (pool) => {
    const stops = await readStops(pool, parcelId);
    assert.deepEqual(stops, original, "plan still routes through the original branch");
    assert.equal(stops[1].branch_id, 1);
  });
});
