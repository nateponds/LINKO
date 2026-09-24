import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

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

test("admin operations aggregate is rejected when unauthenticated", async () => {
  const response = await request("/api/admin/operations");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("non-admin cannot read the operations aggregate", { skip: !hasDb }, async () => {
  for (const email of ["wholesaler@linko.test", "logistics@linko.test", "courier@linko.test", "buyer@linko.test"]) {
    const cookie = await loginAs(email);
    const response = await request("/api/admin/operations", {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 403, email);
    assert.match(response.body.error.message, /forbidden/i);
  }
});

test("admin operations aggregate matches live order, parcel, stock, and courier rows", { skip: !hasDb }, async () => {
  const cookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const parcelIds = [];
  let orderId;
  let courierId;
  let productId;
  let previousStock;

  try {
    const before = await request("/api/admin/operations", { headers: { Cookie: cookie } });
    assert.equal(before.status, 200);
    assert.deepEqual(Object.keys(before.body.openOrders).sort(), [
      "accepted",
      "pending",
      "preparing",
      "shipped",
    ]);
    for (const count of Object.values(before.body.openOrders)) {
      assert.equal(typeof count, "number");
    }
    assert.equal(typeof before.body.unassignedOrBranchlessParcels, "number");
    assert.equal(typeof before.body.lowStockProducts, "number");
    assert.equal(typeof before.body.activeCouriers, "number");

    const businesses = await pool.query(
      `SELECT business_name, business_id, logistics_address_id
         FROM businesses
        WHERE business_name = ANY($1::text[])`,
      [["Cebu Fresh Wholesale", "Sunrise Retail Cooperative"]],
    );
    const byName = Object.fromEntries(businesses.rows.map((row) => [row.business_name, row]));
    const wholesaler = byName["Cebu Fresh Wholesale"];
    const buyer = byName["Sunrise Retail Cooperative"];
    assert.ok(wholesaler?.logistics_address_id);
    assert.ok(buyer?.logistics_address_id);
    const tier = await pool.query("SELECT tier_id FROM service_tiers ORDER BY tier_id LIMIT 1");
    const tierId = tier.rows[0].tier_id;

    const insertedOrder = await pool.query(
      `INSERT INTO orders (buyer_business_id, wholesaler_business_id, tier_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING order_id`,
      [buyer.business_id, wholesaler.business_id, tierId],
    );
    orderId = insertedOrder.rows[0].order_id;

    const product = await pool.query(
      `SELECT product_id, stock_quantity
         FROM products
        WHERE business_id = $1 AND is_active
          AND stock_quantity > 10
        ORDER BY product_id
        LIMIT 1`,
      [wholesaler.business_id],
    );
    assert.ok(product.rows[0], "expected an in-stock wholesaler product to restock-test");
    productId = product.rows[0].product_id;
    previousStock = product.rows[0].stock_quantity;
    await pool.query("UPDATE products SET stock_quantity = 3 WHERE product_id = $1", [productId]);

    const courier = await pool.query(
      `INSERT INTO couriers (full_name, is_active)
       VALUES ('Decision Metric Courier', TRUE)
       RETURNING courier_id`,
    );
    courierId = courier.rows[0].courier_id;

    const branch = await pool.query(
      "SELECT branch_id FROM branches WHERE is_active ORDER BY branch_id LIMIT 1",
    );
    const branchId = branch.rows[0].branch_id;

    async function insertParcel({ id, status, scannedAt, branchId: logBranch, courierId: logCourier }) {
      await pool.query(
        `INSERT INTO parcels (
           parcel_id, sender_id, receiver_id, tier_id,
           origin_address_id, destination_address_id, weight_kg
         ) VALUES ($1, $2, $3, $4, $5, $6, 1.5)`,
        [
          id,
          wholesaler.business_id,
          buyer.business_id,
          tierId,
          wholesaler.logistics_address_id,
          buyer.logistics_address_id,
        ],
      );
      await pool.query(
        `INSERT INTO tracking_logs (parcel_id, status_update, scanned_at, branch_id, courier_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, status, scannedAt, logBranch, logCourier],
      );
      parcelIds.push(id);
    }

    await insertParcel({
      id: `LKO-DECAGE${Date.now().toString().slice(-6)}`,
      status: "Order Created",
      scannedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      branchId: null,
      courierId: null,
    });
    await insertParcel({
      id: `LKO-DECFRESH${Date.now().toString().slice(-5)}`,
      status: "Order Created",
      scannedAt: new Date(),
      branchId,
      courierId: null,
    });
    await insertParcel({
      id: `LKO-DECDONE${Date.now().toString().slice(-6)}`,
      status: "Delivered",
      scannedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      branchId: null,
      courierId: null,
    });

    const after = await request("/api/admin/operations", { headers: { Cookie: cookie } });
    assert.equal(after.status, 200);
    assert.equal(after.body.openOrders.pending, before.body.openOrders.pending + 1);
    assert.equal(after.body.openOrders.accepted, before.body.openOrders.accepted);
    assert.equal(after.body.lowStockProducts, before.body.lowStockProducts + 1);
    assert.equal(after.body.activeCouriers, before.body.activeCouriers + 1);
    // Aging branchless + fresh unassigned count. The delivered branchless
    // parcel is terminal, so it is not an open assignment.
    assert.equal(
      after.body.unassignedOrBranchlessParcels,
      before.body.unassignedOrBranchlessParcels + 2,
    );
  } finally {
    if (parcelIds.length) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = ANY($1::text[])", [parcelIds]);
    }
    if (orderId) await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    if (courierId) await pool.query("DELETE FROM couriers WHERE courier_id = $1", [courierId]);
    if (productId != null) {
      await pool.query("UPDATE products SET stock_quantity = $1 WHERE product_id = $2", [
        previousStock,
        productId,
      ]);
    }
    await pool.end();
  }
});

test("logistics decision counts are rejected for non-coordinators", { skip: !hasDb }, async () => {
  const unauthenticated = await request("/api/logistics/decisions");
  assert.equal(unauthenticated.status, 401);

  for (const email of ["wholesaler@linko.test", "buyer@linko.test", "courier@linko.test"]) {
    const cookie = await loginAs(email);
    const response = await request("/api/logistics/decisions", {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 403, email);
  }
});

test("logistics decision counts follow unassigned, aging, and active-load rows", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const parcelIds = [];

  try {
    const before = await request("/api/logistics/decisions", { headers: { Cookie: cookie } });
    assert.equal(before.status, 200);
    assert.equal(typeof before.body.unassignedParcels, "number");
    assert.equal(typeof before.body.agingPendingParcels, "number");
    assert.equal(typeof before.body.courierActiveLoad, "number");

    const businesses = await pool.query(
      `SELECT business_name, business_id, logistics_address_id
         FROM businesses
        WHERE business_name = ANY($1::text[])`,
      [["Cebu Fresh Wholesale", "Sunrise Retail Cooperative"]],
    );
    const byName = Object.fromEntries(businesses.rows.map((row) => [row.business_name, row]));
    const wholesaler = byName["Cebu Fresh Wholesale"];
    const buyer = byName["Sunrise Retail Cooperative"];
    const tierId = (await pool.query("SELECT tier_id FROM service_tiers ORDER BY tier_id LIMIT 1")).rows[0].tier_id;
    const courierId = (await pool.query("SELECT courier_id FROM couriers WHERE is_active ORDER BY courier_id LIMIT 1")).rows[0].courier_id;
    const branchId = (await pool.query("SELECT branch_id FROM branches WHERE is_active ORDER BY branch_id LIMIT 1")).rows[0].branch_id;

    async function insertParcel(id, status, scannedAt, logBranch, logCourier) {
      await pool.query(
        `INSERT INTO parcels (
           parcel_id, sender_id, receiver_id, tier_id,
           origin_address_id, destination_address_id, weight_kg
         ) VALUES ($1, $2, $3, $4, $5, $6, 1.25)`,
        [
          id,
          wholesaler.business_id,
          buyer.business_id,
          tierId,
          wholesaler.logistics_address_id,
          buyer.logistics_address_id,
        ],
      );
      await pool.query(
        `INSERT INTO tracking_logs (parcel_id, status_update, scanned_at, branch_id, courier_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, status, scannedAt, logBranch, logCourier],
      );
      parcelIds.push(id);
    }

    const stamp = Date.now().toString().slice(-6);
    await insertParcel(`LKO-AGE${stamp}`, "Order Created", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), branchId, null);
    await insertParcel(`LKO-NEW${stamp}`, "Order Created", new Date(Date.now() - 12 * 60 * 60 * 1000), branchId, null);
    await insertParcel(`LKO-LOD${stamp}`, "Out for Delivery", new Date(), branchId, courierId);

    const after = await request("/api/logistics/decisions", { headers: { Cookie: cookie } });
    assert.equal(after.status, 200);
    assert.equal(after.body.unassignedParcels, before.body.unassignedParcels + 2);
    assert.equal(after.body.agingPendingParcels, before.body.agingPendingParcels + 1);
    assert.equal(after.body.courierActiveLoad, before.body.courierActiveLoad + 1);
  } finally {
    if (parcelIds.length) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = ANY($1::text[])", [parcelIds]);
    }
    await pool.end();
  }
});

test("wholesaler dashboard reports incoming pending and accepted orders", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;

  try {
    const before = await request("/api/dashboard", { headers: { Cookie: cookie } });
    assert.equal(before.status, 200);
    assert.equal(typeof before.body.actionableOrders.pending, "number");
    assert.equal(typeof before.body.actionableOrders.accepted, "number");

    const businesses = await pool.query(
      `SELECT business_name, business_id
         FROM businesses
        WHERE business_name = ANY($1::text[])`,
      [["Cebu Fresh Wholesale", "Sunrise Retail Cooperative"]],
    );
    const byName = Object.fromEntries(businesses.rows.map((row) => [row.business_name, row]));
    const tierId = (await pool.query("SELECT tier_id FROM service_tiers ORDER BY tier_id LIMIT 1")).rows[0].tier_id;
    const inserted = await pool.query(
      `INSERT INTO orders (buyer_business_id, wholesaler_business_id, tier_id, status)
       VALUES ($1, $2, $3, 'accepted')
       RETURNING order_id`,
      [byName["Sunrise Retail Cooperative"].business_id, byName["Cebu Fresh Wholesale"].business_id, tierId],
    );
    orderId = inserted.rows[0].order_id;

    const after = await request("/api/dashboard", { headers: { Cookie: cookie } });
    assert.equal(after.body.actionableOrders.accepted, before.body.actionableOrders.accepted + 1);
    assert.equal(after.body.actionableOrders.pending, before.body.actionableOrders.pending);
  } finally {
    if (orderId) await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    await pool.end();
  }
});
