import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Courier delivery workflow (docs/API_CONTRACTS.md §3.6): wholesaler
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

async function createWorkflowProduct(pool, productName) {
  const refs = await pool.query(
    `SELECT m.business_id, st.tier_id, st.base_fee::float8
       FROM business_memberships m
       JOIN users u ON u.user_id = m.user_id
       CROSS JOIN LATERAL (SELECT tier_id, base_fee FROM service_tiers ORDER BY tier_id LIMIT 1) st
      WHERE u.email = 'wholesaler@linko.test' AND m.role = 'wholesaler'
      LIMIT 1`,
  );
  assert.ok(refs.rows[0], "expected a seeded wholesaler business");
  const product = await pool.query(
    `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
     VALUES ($1, $2, $3, 100, 2)
     RETURNING product_id, unit_price::float8`,
    [
      refs.rows[0].business_id,
      productName,
      `WORKFLOW-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ],
  );
  return {
    productId: product.rows[0].product_id,
    unitPrice: product.rows[0].unit_price,
    tierId: refs.rows[0].tier_id,
    baseFee: refs.rows[0].base_fee,
  };
}

test("courier picks up from the pool and delivering the parcel completes the order", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");
    const courierCookie = await loginAs("courier@linko.test");

    const {
      productId: createdProductId,
      unitPrice: goodsSubtotal,
      tierId,
      baseFee,
    } = await createWorkflowProduct(pool, "Courier Delivery Workflow Product");
    productId = createdProductId;

    const created = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing", "shipped"]) {
      const body = status === "shipped"
        ? { status, weight_kg: 3.5, total_distance_km: 10 }
        : { status };
      const step = await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify(body),
      });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }

    // Shipping auto-created a parcel linked back to the order.
    const parcelRow = await pool.query(
      `SELECT p.parcel_id,
              p.declared_value::float8,
              p.shipping_fee::float8,
              pay.amount::float8 AS payment_total
         FROM parcels p
         JOIN payments pay ON pay.parcel_id = p.parcel_id
        WHERE p.order_id = $1`,
      [orderId],
    );
    assert.ok(parcelRow.rows[0], "shipping should create a parcel with order_id set");
    const parcelId = parcelRow.rows[0].parcel_id;
    assert.equal(parcelRow.rows[0].declared_value, goodsSubtotal);
    const expectedShippingFee = baseFee + (3.5 * 20) + (10 * 2);
    assert.equal(parcelRow.rows[0].shipping_fee, expectedShippingFee);
    assert.equal(
      parcelRow.rows[0].payment_total,
      goodsSubtotal + expectedShippingFee,
    );

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

    // Transition map: delivery attempt requires an Out for Delivery scan first.
    const ofd = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Out for Delivery" }),
    });
    assert.equal(ofd.status, 201);

    // Delivered scan flips the linked order automatically; the POD remark is
    // auto-generated from accounts (courier → receiver business).
    const delivered = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Delivered" }),
    });
    assert.equal(delivered.status, 201);
    assert.match(delivered.body.remarks, /→ Sunrise Retail Cooperative$/);

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
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});

test("Cancelled scan requires a reason, cancels the order, notifies both parties", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");
    const courierCookie = await loginAs("courier@linko.test");
    const coordinatorCookie = await loginAs("logistics@linko.test");

    const workflowProduct = await createWorkflowProduct(pool, "Cancellation Workflow Product");
    productId = workflowProduct.productId;
    const { tierId } = workflowProduct;

    const created = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({
        items: [{ product_id: productId, quantity: 1 }],
        tier_id: tierId,
      }),
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing", "shipped"]) {
      const body = status === "shipped"
        ? { status, weight_kg: 2.0, total_distance_km: 10 }
        : { status };
      const step = await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify(body),
      });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }

    const parcelRow = await pool.query(
      "SELECT parcel_id FROM parcels WHERE order_id = $1",
      [orderId],
    );
    assert.ok(parcelRow.rows[0], "shipping should create a parcel");
    const parcelId = parcelRow.rows[0].parcel_id;

    // Courier cannot cancel.
    const courierAttempt = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Cancelled", remarks: "nope" }),
    });
    assert.equal(courierAttempt.status, 400);

    // Coordinator cancel without a reason is rejected.
    const noReason = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ status_update: "Cancelled" }),
    });
    assert.equal(noReason.status, 400);

    // Coordinator cancel with a reason succeeds.
    const cancel = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ status_update: "Cancelled", remarks: "Buyer requested cancellation" }),
    });
    assert.equal(cancel.status, 201);

    const order = await request(`/api/orders/${orderId}`, { headers: { Cookie: buyerCookie } });
    assert.equal(order.body.status, "cancelled");

    const buyerNotif = await request("/api/notifications", { headers: { Cookie: buyerCookie } });
    assert.ok(
      buyerNotif.body.some(
        (n) => n.title === "Order Cancelled" && n.message.includes(`#${orderId}`),
      ),
      "buyer should be notified of the cancellation",
    );
    const wholesalerNotif = await request("/api/notifications", { headers: { Cookie: wholesalerCookie } });
    assert.ok(
      wholesalerNotif.body.some(
        (n) => n.title === "Order Cancelled" && n.message.includes(`#${orderId}`),
      ),
      "wholesaler should be notified of the cancellation",
    );

    // Already-terminal parcel cannot be cancelled again.
    const recancel = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ status_update: "Cancelled", remarks: "again" }),
    });
    assert.equal(recancel.status, 400);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});

test("Delivery Failed requires a known failure reason in remarks", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");
    const courierCookie = await loginAs("courier@linko.test");

    const seedRefs = await pool.query(
      `SELECT m.business_id, st.tier_id
         FROM business_memberships m
         JOIN users u ON u.user_id = m.user_id
         CROSS JOIN LATERAL (SELECT tier_id FROM service_tiers ORDER BY tier_id LIMIT 1) st
        WHERE u.email = 'wholesaler@linko.test' AND m.role = 'wholesaler'
        LIMIT 1`,
    );
    assert.ok(seedRefs.rows[0], "expected a seeded wholesaler business");
    const { business_id: wholesalerBusinessId, tier_id: tierId } = seedRefs.rows[0];
    const product = await pool.query(
      `INSERT INTO products
         (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES ($1, 'Delivery Failure Reason Test Product', $2, 100, 2)
       RETURNING product_id`,
      [wholesalerBusinessId, `FAIL-REASON-${Date.now()}`],
    );
    productId = product.rows[0].product_id;

    const created = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing", "shipped"]) {
      const body = status === "shipped"
        ? { status, weight_kg: 2.0, total_distance_km: 10 }
        : { status };
      const step = await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify(body),
      });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }

    const parcelRow = await pool.query(
      "SELECT parcel_id FROM parcels WHERE order_id = $1",
      [orderId],
    );
    assert.ok(parcelRow.rows[0], "shipping should create a parcel");
    const parcelId = parcelRow.rows[0].parcel_id;

    // Get to a valid Out for Delivery state.
    for (const status_update of ["Picked Up", "Out for Delivery"]) {
      const step = await request(`/api/parcels/${parcelId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: courierCookie },
        body: JSON.stringify({ status_update }),
      });
      assert.equal(step.status, 201, `courier should reach ${status_update}`);
    }

    // Delivery Failed with no reason is rejected.
    const noReason = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Delivery Failed" }),
    });
    assert.equal(noReason.status, 400);

    // An unrecognized reason is rejected too.
    const badReason = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Delivery Failed", remarks: "Package wet" }),
    });
    assert.equal(badReason.status, 400);

    // A known soft reason is accepted.
    const ok = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Delivery Failed", remarks: "Receiver unavailable" }),
    });
    assert.equal(ok.status, 201);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});
