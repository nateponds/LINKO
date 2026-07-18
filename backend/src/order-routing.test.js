import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 13 T06: marketplace shipments — buyer pin gate at order placement,
// wholesaler pin gate at ship time, canonical logistics addresses, server
// distance, route snapshots, hard rollback on missing addresses.
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

const postJson = (path, cookie, body) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

const patchStatus = (orderId, cookie, body) =>
  request(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });

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

async function createProductFor(pool, businessId) {
  const { rows } = await pool.query(
    `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
     VALUES ($1, 'T06 Routing Product', $2, 100, 20)
     RETURNING product_id`,
    [businessId, `T06-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`],
  );
  return rows[0].product_id;
}

// Fresh businesses register with an unpinned placeholder address.
async function registerBusiness(businessType) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `t06-${stamp}@linko.test`;
  const response = await postJson("/api/auth/register", null, {
    email,
    password: "Password123!",
    full_name: "T06 Test",
    business_name: `T06 ${businessType} ${stamp}`,
    business_type: businessType,
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
  return { businessId, addressId, email };
}

async function assertNoParcel(pool, orderId, context) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM parcels WHERE order_id = $1",
    [orderId],
  );
  assert.equal(rows[0].n, 0, `no parcel rows: ${context}`);
}

async function orderStatus(pool, orderId) {
  const { rows } = await pool.query(
    "SELECT status FROM orders WHERE order_id = $1",
    [orderId],
  );
  return rows[0].status;
}

test("shipping routes from canonical addresses with server distance and snapshot", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  await withPool(async (pool) => {
    let orderId;
    let productId;
    try {
      productId = await createProductFor(pool, 2); // Cebu Fresh Wholesale
      const created = await postJson("/api/orders", buyerCookie, {
        tier_id: 1,
        items: [{ product_id: productId, quantity: 1 }],
      });
      assert.equal(created.status, 201);
      orderId = created.body.order_id;

      for (const status of ["accepted", "preparing"]) {
        const step = await patchStatus(orderId, wholesalerCookie, { status });
        assert.equal(step.status, 200);
      }
      // client-supplied distance must be ignored
      const shipped = await patchStatus(orderId, wholesalerCookie, {
        status: "shipped",
        weight_kg: 2,
        total_distance_km: 9999,
      });
      assert.equal(shipped.status, 200);

      const parcel = await pool.query(
        `SELECT parcel_id, origin_address_id, destination_address_id,
                total_distance_km::float8 AS distance_km, shipping_fee::float8 AS fee
           FROM parcels WHERE order_id = $1`,
        [orderId],
      );
      assert.equal(parcel.rows.length, 1);
      const row = parcel.rows[0];
      // Canonical pins: wholesaler 2 -> WAREHOUSE addr 3 (never the office
      // addr 2 the old LIMIT 1 picked); buyer 1 -> addr 1.
      assert.equal(row.origin_address_id, 3, "origin is the canonical warehouse address");
      assert.equal(row.destination_address_id, 1, "destination is the buyer's canonical address");

      const expectedKm = haversineKm(10.3444, 123.9137, 10.3283, 123.8988);
      assert.ok(Math.abs(row.distance_km - expectedKm) < 0.01, `server distance, got ${row.distance_km}`);
      // tier 1: 50 base + 2kg x 20 + km x 2
      assert.ok(Math.abs(row.fee - (50 + 40 + row.distance_km * 2)) < 0.05, `fee from server distance, got ${row.fee}`);

      const log = await pool.query(
        "SELECT branch_id FROM tracking_logs WHERE parcel_id = $1 ORDER BY log_id",
        [row.parcel_id],
      );
      assert.equal(log.rows.length, 1);
      assert.equal(log.rows[0].branch_id, 1, "warehouse addr 3 is nearest the Cebu hub");

      const stops = await pool.query(
        `SELECT stop_order, stop_type, branch_id, label
           FROM parcel_route_stops WHERE parcel_id = $1 ORDER BY stop_order`,
        [row.parcel_id],
      );
      assert.equal(stops.rows.length, 3, "snapshot is exactly 3 stops");
      assert.deepEqual(
        stops.rows.map((s) => [s.stop_type, s.label]),
        [
          ["origin", "Cebu Fresh Wholesale"],
          ["branch", "LINKO Cebu Central Hub"],
          ["destination", "Sunrise Retail Cooperative"],
        ],
      );
      assert.equal(stops.rows[1].branch_id, 1);
    } finally {
      if (orderId) {
        await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
        await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM invoices WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
      }
      if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
  });
});

test("unpinned buyer cannot place an order (409, contracted message)", { skip: !hasDb }, async () => {
  const buyer = await registerBusiness("buyer");
  const buyerCookie = await loginAs(buyer.email);
  const adminCookie = await loginAs("admin@linko.test");
  await withPool(async (pool) => {
    let productId;
    try {
      productId = await createProductFor(pool, 2);
      const body = { tier_id: 1, items: [{ product_id: productId, quantity: 1 }] };

      const gated = await postJson("/api/orders", buyerCookie, body);
      assert.equal(gated.status, 409);
      assert.equal(
        gated.body.error.message,
        "Pin your business location in Settings before placing orders",
      );

      // Admin acting with an explicit buyer_business_id is gated on that
      // business the same way.
      const adminGated = await postJson("/api/orders", adminCookie, {
        ...body,
        buyer_business_id: buyer.businessId,
      });
      assert.equal(adminGated.status, 409);

      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM orders WHERE buyer_business_id = $1",
        [buyer.businessId],
      );
      assert.equal(rows[0].n, 0, "no order rows created for the gated buyer");
    } finally {
      if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
  });
});

test("unpinned wholesaler cannot ship: 409, order stays preparing, nothing persisted", { skip: !hasDb }, async () => {
  const wholesaler = await registerBusiness("wholesaler");
  const wholesalerCookie = await loginAs(wholesaler.email);
  const buyerCookie = await loginAs("buyer@linko.test");
  await withPool(async (pool) => {
    let orderId;
    let productId;
    try {
      productId = await createProductFor(pool, wholesaler.businessId);
      const created = await postJson("/api/orders", buyerCookie, {
        tier_id: 1,
        items: [{ product_id: productId, quantity: 1 }],
      });
      assert.equal(created.status, 201, "pinned buyer passes the placement gate");
      orderId = created.body.order_id;

      for (const status of ["accepted", "preparing"]) {
        const step = await patchStatus(orderId, wholesalerCookie, { status });
        assert.equal(step.status, 200, `unpinned wholesaler may still reach ${status}`);
      }

      const gated = await patchStatus(orderId, wholesalerCookie, { status: "shipped", weight_kg: 2 });
      assert.equal(gated.status, 409);
      assert.equal(
        gated.body.error.message,
        "Pin your business location in Settings before shipping orders",
      );
      assert.equal(await orderStatus(pool, orderId), "preparing", "409 rolls back the transition");
      await assertNoParcel(pool, orderId, "unpinned wholesaler ship");

      // Missing canonical address (pointer NULL) hard-fails the same way —
      // shipping never silently skips parcel creation.
      await pool.query(
        "UPDATE businesses SET logistics_address_id = NULL WHERE business_id = $1",
        [wholesaler.businessId],
      );
      const noAddress = await patchStatus(orderId, wholesalerCookie, { status: "shipped", weight_kg: 2 });
      assert.equal(noAddress.status, 409);
      assert.equal(await orderStatus(pool, orderId), "preparing");
      await assertNoParcel(pool, orderId, "missing wholesaler canonical address");

      // Pinning the business clears the gate and shipping completes.
      await pool.query(
        "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = $2",
        [wholesaler.addressId, wholesaler.businessId],
      );
      await pool.query(
        "UPDATE addresses SET latitude = 10.3400, longitude = 123.9100 WHERE address_id = $1",
        [wholesaler.addressId],
      );
      const shipped = await patchStatus(orderId, wholesalerCookie, { status: "shipped", weight_kg: 2 });
      assert.equal(shipped.status, 200, "pinned wholesaler ships normally");
      const parcel = await pool.query(
        "SELECT total_distance_km::float8 AS distance_km FROM parcels WHERE order_id = $1",
        [orderId],
      );
      assert.equal(parcel.rows.length, 1);
      assert.ok(parcel.rows[0].distance_km > 0, "server distance priced after pinning");
    } finally {
      if (orderId) {
        await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
        await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM invoices WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
      }
      if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
  });
});

test("buyer pin removed between placement and ship: defensive 409 with rollback", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  await withPool(async (pool) => {
    let orderId;
    let productId;
    let savedPointer;
    try {
      productId = await createProductFor(pool, 2);
      const created = await postJson("/api/orders", buyerCookie, {
        tier_id: 1,
        items: [{ product_id: productId, quantity: 1 }],
      });
      assert.equal(created.status, 201);
      orderId = created.body.order_id;

      for (const status of ["accepted", "preparing"]) {
        const step = await patchStatus(orderId, wholesalerCookie, { status });
        assert.equal(step.status, 200);
      }

      const saved = await pool.query(
        "SELECT logistics_address_id FROM businesses WHERE business_id = 1",
      );
      savedPointer = saved.rows[0].logistics_address_id;
      await pool.query(
        "UPDATE businesses SET logistics_address_id = NULL WHERE business_id = 1",
      );

      const gated = await patchStatus(orderId, wholesalerCookie, { status: "shipped", weight_kg: 2 });
      assert.equal(gated.status, 409);
      assert.equal(gated.body.error.message, "Buyer business has no pinned location");
      assert.equal(await orderStatus(pool, orderId), "preparing", "409 rolls back the transition");
      await assertNoParcel(pool, orderId, "buyer canonical address missing at ship");

      await pool.query(
        "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = 1",
        [savedPointer],
      );
      savedPointer = null;
      const shipped = await patchStatus(orderId, wholesalerCookie, { status: "shipped", weight_kg: 2 });
      assert.equal(shipped.status, 200, "restoring the pin unblocks shipping");
    } finally {
      if (savedPointer != null) {
        await pool.query(
          "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = 1",
          [savedPointer],
        );
      }
      if (orderId) {
        await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
        await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM invoices WHERE order_id = $1", [orderId]);
        await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
      }
      if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
  });
});
