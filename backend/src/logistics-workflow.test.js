import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Courier delivery workflow (docs/delivery-status-logistics.md): wholesaler
// stops at 'shipped', courier claims from the pickup pool and their
// 'Delivered' scan completes the order. DB-backed, skips without
// DATABASE_URL, relies on the dev seed accounts.
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

test("courier picks up from the pool and delivering the parcel completes the order", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");
    const courierCookie = await loginAs("courier@linko.test");

    const seedRefs = await pool.query(
      `SELECT p.product_id, (SELECT MIN(tier_id) FROM service_tiers) AS tier_id
         FROM products p
         JOIN business_memberships m ON m.business_id = p.business_id AND m.role = 'wholesaler'
         JOIN users u ON u.user_id = m.user_id
        WHERE u.email = 'wholesaler@linko.test' AND p.is_active = TRUE
        LIMIT 1`,
    );
    assert.ok(seedRefs.rows[0], "expected a seeded wholesaler product");
    const { product_id: productId, tier_id: tierId } = seedRefs.rows[0];

    const created = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing", "shipped"]) {
      const step = await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify({ status }),
      });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }

    // Shipping auto-created a parcel linked back to the order.
    const parcelRow = await pool.query(
      "SELECT parcel_id FROM parcels WHERE order_id = $1",
      [orderId],
    );
    assert.ok(parcelRow.rows[0], "shipping should create a parcel with order_id set");
    const parcelId = parcelRow.rows[0].parcel_id;

    // Delivery is the courier's call now, not the wholesaler's.
    const wholesalerDelivers = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "delivered" }),
    });
    assert.equal(wholesalerDelivers.status, 403);

    // The unassigned parcel is visible in the courier's pickup pool.
    const poolList = await request("/api/parcels", { headers: { Cookie: courierCookie } });
    assert.equal(poolList.status, 200);
    assert.ok(
      poolList.body.some((p) => p.parcel_id === parcelId),
      "unassigned parcel should appear in the courier pickup pool",
    );

    // Claiming stamps the courier's own id, ignoring any spoofed value.
    const pickup = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Picked Up", courier_id: 999999 }),
    });
    assert.equal(pickup.status, 201);
    assert.ok(pickup.body.courier_id, "scan should be stamped with a courier_id");
    assert.notEqual(pickup.body.courier_id, 999999);

    // Regression (vanishing-parcel bug): the parcel stays in the courier's
    // list after they act on it.
    const afterPickup = await request("/api/parcels", { headers: { Cookie: courierCookie } });
    assert.ok(
      afterPickup.body.some((p) => p.parcel_id === parcelId && p.current_status === "Picked Up"),
      "claimed parcel should remain visible to the courier",
    );

    // Delivered scan flips the linked order automatically.
    const delivered = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Delivered" }),
    });
    assert.equal(delivered.status, 201);

    const order = await request(`/api/orders/${orderId}`, { headers: { Cookie: buyerCookie } });
    assert.equal(order.status, 200);
    assert.equal(order.body.status, "delivered");

    const deliveredNotif = await request("/api/notifications", { headers: { Cookie: buyerCookie } });
    assert.ok(
      deliveredNotif.body.some(
        (n) => n.title === "Order Delivered" && n.message.includes(`#${orderId}`),
      ),
      "buyer should be notified the order was delivered",
    );
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    await pool.end();
  }
});
