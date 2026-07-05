import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

async function request(path, options) {
  const server = createServer(createApp());

  // Port 0 asks Windows to choose any free port, so tests do not fail just
  // because another local dev server is already using port 5000.
  await new Promise((resolve) => server.listen(0, resolve));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await response.json();

  await new Promise((resolve) => server.close(resolve));

  return { body, status: response.status };
}

test("health route reports ok", async () => {
  const response = await request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("inventory route is scaffolded", async () => {
  const response = await request("/api/inventory");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("supplier route is scaffolded", async () => {
  const response = await request("/api/suppliers");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("mutating placeholder routes return not implemented", async () => {
  const response = await request("/api/inventory", { method: "POST" });

  assert.equal(response.status, 501);
  assert.match(response.body.error.message, /not implemented/i);
});

test("parcel booking rejects missing fields before touching the database", async () => {
  const response = await request("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weight_kg: 2 }),
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /Missing required fields/);
});

test("parcel booking rejects a bad payment method", async () => {
  const response = await request("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 2,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 2,
      weight_kg: 2,
      payment_method: "Barter",
    }),
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /payment_method/);
});

// The tests below hit the real database, so they only run when the developer
// has one configured -- same requirement as npm run migrate.
const hasDb = Boolean(process.env.DATABASE_URL);

test("service tiers come back from the database", { skip: !hasDb }, async () => {
  const response = await request("/api/service-tiers");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
});

test("parcel list includes current status from tracking logs", { skip: !hasDb }, async () => {
  const response = await request("/api/parcels");

  assert.equal(response.status, 200);
  for (const parcel of response.body) {
    assert.ok("current_status" in parcel);
    assert.ok(parcel.sender.full_name);
  }
});

test("unknown parcel returns 404", { skip: !hasDb }, async () => {
  const response = await request("/api/parcels/NOPE-404");

  assert.equal(response.status, 404);
});

test("booking a parcel creates payment, commission, and first log", { skip: !hasDb }, async () => {
  const created = await request("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 7,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 7,
      weight_kg: 2.5,
      declared_value: 1000,
      total_distance_km: 10,
      payment_method: "COD",
    }),
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.current_status, "Order Created");
  // 003 trigger: 45 base + 2.5kg x 20 + 10km x 2 = 115.00 on the Standard tier
  assert.equal(created.body.shipping_fee, 115);

  const detail = await request(`/api/parcels/${created.body.parcel_id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.payment.amount, 1115);
  assert.equal(detail.body.tracking_history.length, 1);

  // Remove the test booking so repeated runs do not pile up demo data.
  // Payments, logs, and the commission row cascade with the parcel.
  const { createPool } = await import("./db.js");
  const pool = createPool();
  await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [
    created.body.parcel_id,
  ]);
  await pool.end();
});
