import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 8 workflow integrity: ship-time weight entry, method-honest payment
// lifecycle, courier POD remarks, and the buyer's read-only tracking scope.
// DB-backed, skips without DATABASE_URL, relies on the dev seed accounts
// (backend/seeds/dev_seed.sql; password "Password123!" for every account).
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
  assert.equal(response.status, 200, `login should succeed for ${email}`);
  assert.match(response.setCookie, /linko_session=/);
  return response.setCookie.split(";")[0];
}

async function postJson(path, cookie, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

async function patchStatus(orderId, cookie, body) {
  return request(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

async function getBusinessIdByName(pool, name) {
  const { rows } = await pool.query(
    "SELECT business_id FROM businesses WHERE business_name = $1",
    [name],
  );
  assert.ok(rows[0], `expected business ${name} to exist`);
  return rows[0].business_id;
}

async function getAddressIdForBusiness(pool, businessName) {
  const businessId = await getBusinessIdByName(pool, businessName);
  const { rows } = await pool.query(
    "SELECT address_id FROM addresses WHERE business_id = $1 ORDER BY address_id LIMIT 1",
    [businessId],
  );
  assert.ok(rows[0], `expected business ${businessName} to have an address`);
  return rows[0].address_id;
}

async function createTestProduct(pool) {
  const wholesalerId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
  const product = await pool.query(
    `INSERT INTO products
       (business_id, product_name, sku, unit_price, stock_quantity)
     VALUES ($1, 'Sprint8 Test Crate', $2, 100, 20)
     RETURNING product_id`,
    [wholesalerId, `S8-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`],
  );
  return product.rows[0].product_id;
}

// Direct-SQL parcel fixture in the branch-1 pickup pool so courier@linko.test
// (assigned branch 1) can act on it. Mirrors logistics-authz.test.js.
async function createPoolParcel(pool, { paymentMethod } = {}) {
  const senderId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
  const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
  const originAddressId = await getAddressIdForBusiness(pool, "Cebu Fresh Wholesale");
  const destinationAddressId = await getAddressIdForBusiness(pool, "Sunrise Retail Cooperative");
  const parcelId = `TST-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

  await pool.query(
    `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                          origin_address_id, destination_address_id, weight_kg)
     VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
    [parcelId, senderId, receiverId, originAddressId, destinationAddressId],
  );
  if (paymentMethod) {
    await pool.query(
      `INSERT INTO payments (parcel_id, method, payment_status, amount)
       VALUES ($1, $2, 'Pending', NULL)`,
      [parcelId, paymentMethod],
    );
  }
  await pool.query(
    `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
     VALUES ($1, 'Order Created', 'Sprint 8 fixture', 1, NULL)`,
    [parcelId],
  );
  return parcelId;
}

async function getPayment(pool, parcelId) {
  const { rows } = await pool.query(
    "SELECT method, payment_status, paid_at FROM payments WHERE parcel_id = $1",
    [parcelId],
  );
  return rows[0];
}

test("shipping records the entered weight and the buyer can track their own parcel", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const otherBuyerCookie = await loginAs("buyer2@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");

    productId = await createTestProduct(pool);
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1,
      items: [{ product_id: productId, quantity: 2 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing"]) {
      const step = await patchStatus(orderId, wholesalerCookie, { status });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }

    // Weight is required at the physical handoff — no silent placeholder.
    const noWeight = await patchStatus(orderId, wholesalerCookie, { status: "shipped" });
    assert.equal(noWeight.status, 400);
    assert.match(noWeight.body.error.message, /weight_kg/);

    const shipped = await patchStatus(orderId, wholesalerCookie, {
      status: "shipped",
      weight_kg: 7.5,
      dimensions: "40x30x20 cm",
    });
    assert.equal(shipped.status, 200);

    const parcelRow = await pool.query(
      `SELECT p.parcel_id,
              p.weight_kg::float8,
              p.dimensions,
              p.total_distance_km,
              (p.estimated_delivery_date = CURRENT_DATE + st.estimated_days) AS eta_from_tier
         FROM parcels p
         JOIN service_tiers st ON st.tier_id = p.tier_id
        WHERE p.order_id = $1`,
      [orderId],
    );
    assert.ok(parcelRow.rows[0], "shipping should auto-create the parcel");
    const parcel = parcelRow.rows[0];
    assert.equal(parcel.weight_kg, 7.5);
    assert.equal(parcel.dimensions, "40x30x20 cm");
    assert.equal(parcel.total_distance_km, null);
    assert.equal(parcel.eta_from_tier, true);

    // Marketplace checkout is an online payment: settled at booking.
    const payment = await getPayment(pool, parcel.parcel_id);
    assert.equal(payment.method, "Online");
    assert.equal(payment.payment_status, "Paid");
    assert.ok(payment.paid_at, "online payment should carry paid_at");

    // The order exposes its parcel and the buyer can read that one parcel...
    const orderView = await request(`/api/orders/${orderId}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(orderView.status, 200);
    assert.equal(orderView.body.parcel_id, parcel.parcel_id);

    const buyerParcel = await request(`/api/parcels/${parcel.parcel_id}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(buyerParcel.status, 200);
    assert.equal(buyerParcel.body.parcel_id, parcel.parcel_id);
    assert.equal(buyerParcel.body.sender_id, undefined);
    assert.equal(buyerParcel.body.receiver_id, undefined);

    // ...but an unrelated buyer gets a 404, and the buyer's list stays empty.
    const foreign = await request(`/api/parcels/${parcel.parcel_id}`, {
      headers: { Cookie: otherBuyerCookie },
    });
    assert.equal(foreign.status, 404);

    const buyerList = await request("/api/parcels", {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(buyerList.status, 200);
    assert.ok(
      !buyerList.body.some((p) => p.parcel_id === parcel.parcel_id),
      "buyer list must not enumerate buyer-scoped parcels",
    );
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

test("courier terminal scans require remarks; coordinators stay exempt", { skip: !hasDb }, async () => {
  const pool = createPool();
  const parcelIds = [];
  try {
    const courierCookie = await loginAs("courier@linko.test");
    const coordinatorCookie = await loginAs("logistics@linko.test");

    for (const [status, remarks] of [
      ["Delivered", "Received by Bianca Buyer"],
      ["Returned", "Receiver moved away"],
    ]) {
      const parcelId = await createPoolParcel(pool);
      parcelIds.push(parcelId);

      const bare = await postJson(`/api/parcels/${parcelId}/tracking`, courierCookie, {
        status_update: status,
      });
      assert.equal(bare.status, 400, `${status} without remarks should be rejected`);
      assert.match(bare.body.error.message, /remarks/);

      const blank = await postJson(`/api/parcels/${parcelId}/tracking`, courierCookie, {
        status_update: status,
        remarks: "   ",
      });
      assert.equal(blank.status, 400, `${status} with blank remarks should be rejected`);

      const withPod = await postJson(`/api/parcels/${parcelId}/tracking`, courierCookie, {
        status_update: status,
        remarks,
      });
      assert.equal(withPod.status, 201, `${status} with remarks should succeed`);
      assert.equal(withPod.body.remarks, remarks);
    }

    // Coordinator correction path keeps working without forced POD text.
    const correctionParcel = await createPoolParcel(pool);
    parcelIds.push(correctionParcel);
    const coordinatorScan = await postJson(
      `/api/parcels/${correctionParcel}/tracking`,
      coordinatorCookie,
      { status_update: "Delivered" },
    );
    assert.equal(coordinatorScan.status, 201);
  } finally {
    for (const id of parcelIds) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [id]);
    }
    await pool.end();
  }
});

test("payment lifecycle follows the method", { skip: !hasDb }, async () => {
  const pool = createPool();
  const parcelIds = [];
  try {
    const coordinatorCookie = await loginAs("logistics@linko.test");
    const senderId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const originAddressId = await getAddressIdForBusiness(pool, "Cebu Fresh Wholesale");
    const destinationAddressId = await getAddressIdForBusiness(pool, "Sunrise Retail Cooperative");

    const book = async (payment_method) => {
      const created = await postJson("/api/parcels", coordinatorCookie, {
        sender_id: senderId,
        receiver_id: receiverId,
        tier_id: 1,
        origin_address_id: originAddressId,
        destination_address_id: destinationAddressId,
        weight_kg: 2.5,
        declared_value: 500,
        payment_method,
      });
      assert.equal(created.status, 201, `${payment_method} booking should succeed`);
      parcelIds.push(created.body.parcel_id);
      return created.body.parcel_id;
    };

    // Prepaid settles at booking; COD does not.
    const prepaidId = await book("Prepaid");
    const prepaid = await getPayment(pool, prepaidId);
    assert.equal(prepaid.payment_status, "Paid");
    assert.ok(prepaid.paid_at);

    const codDeliveredId = await book("COD");
    let cod = await getPayment(pool, codDeliveredId);
    assert.equal(cod.payment_status, "Pending");
    assert.equal(cod.paid_at, null);

    // COD collects on Delivered...
    const delivered = await postJson(
      `/api/parcels/${codDeliveredId}/tracking`,
      coordinatorCookie,
      { status_update: "Delivered", remarks: "COD collected at door" },
    );
    assert.equal(delivered.status, 201);
    cod = await getPayment(pool, codDeliveredId);
    assert.equal(cod.payment_status, "Paid");
    assert.ok(cod.paid_at);

    // ...and fails on Returned.
    const codReturnedId = await book("COD");
    const returned = await postJson(
      `/api/parcels/${codReturnedId}/tracking`,
      coordinatorCookie,
      { status_update: "Returned", remarks: "Refused at door" },
    );
    assert.equal(returned.status, 201);
    const failed = await getPayment(pool, codReturnedId);
    assert.equal(failed.payment_status, "Failed");
    assert.equal(failed.paid_at, null);
  } finally {
    for (const id of parcelIds) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [id]);
    }
    await pool.end();
  }
});
