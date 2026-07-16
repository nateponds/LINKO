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

test("courier terminal scans auto-generate POD; coordinators keep manual remarks", { skip: !hasDb }, async () => {
  const pool = createPool();
  const parcelIds = [];
  const AUTO_POD = "Cory Courier → Sunrise Retail Cooperative";
  try {
    const courierCookie = await loginAs("courier@linko.test");
    const coordinatorCookie = await loginAs("logistics@linko.test");

    const walk = async (parcelId, statuses) => {
      for (const status_update of statuses) {
        const step = await postJson(`/api/parcels/${parcelId}/tracking`, courierCookie, {
          status_update,
        });
        assert.equal(step.status, 201, `courier should reach ${status_update}`);
      }
    };

    // Delivered: remark is generated from accounts even when the client sends
    // nothing — and a client-sent remark on a courier terminal scan is replaced.
    const deliveredParcel = await createPoolParcel(pool);
    parcelIds.push(deliveredParcel);
    await walk(deliveredParcel, ["Picked Up", "Out for Delivery"]);
    const delivered = await postJson(`/api/parcels/${deliveredParcel}/tracking`, courierCookie, {
      status_update: "Delivered",
      remarks: "client-typed text must not win",
    });
    assert.equal(delivered.status, 201);
    assert.equal(delivered.body.remarks, AUTO_POD);

    // Returned (end of the return leg): reached only after 3 Delivery Failed
    // scans open the return leg, then Arrived at Branch -> Returned. Same auto-POD.
    const returnedParcel = await createPoolParcel(pool);
    parcelIds.push(returnedParcel);
    await walk(returnedParcel, [
      "Picked Up",
      "Out for Delivery",
      "Delivery Failed",
      "Out for Delivery",
      "Delivery Failed",
      "Out for Delivery",
      "Delivery Failed",
      "Arrived at Branch",
    ]);
    const returned = await postJson(`/api/parcels/${returnedParcel}/tracking`, courierCookie, {
      status_update: "Returned",
    });
    assert.equal(returned.status, 201);
    assert.equal(returned.body.remarks, AUTO_POD);

    // Coordinator keeps the manual-remark override, but still follows the
    // checkpoint map like couriers (handoff §2) — no Order Created -> Delivered
    // jump. Walk to Out for Delivery, then deliver with a manual remark.
    const correctionParcel = await createPoolParcel(pool);
    parcelIds.push(correctionParcel);
    for (const status_update of ["Picked Up", "Out for Delivery"]) {
      const step = await postJson(`/api/parcels/${correctionParcel}/tracking`, coordinatorCookie, {
        status_update,
      });
      assert.equal(step.status, 201, `coordinator should reach ${status_update}`);
    }
    const coordinatorScan = await postJson(
      `/api/parcels/${correctionParcel}/tracking`,
      coordinatorCookie,
      { status_update: "Delivered", remarks: "Manual correction" },
    );
    assert.equal(coordinatorScan.status, 201);
    assert.equal(coordinatorScan.body.remarks, "Manual correction");
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

    // The checkpoint map binds coordinators too — walk to a terminal status
    // through valid edges before settling the payment.
    const walkTo = async (parcelId, statuses) => {
      for (const status_update of statuses) {
        const step = await postJson(`/api/parcels/${parcelId}/tracking`, coordinatorCookie, {
          status_update,
        });
        assert.equal(step.status, 201, `should reach ${status_update}`);
      }
    };

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
    await walkTo(codDeliveredId, ["Picked Up", "Out for Delivery"]);
    const delivered = await postJson(
      `/api/parcels/${codDeliveredId}/tracking`,
      coordinatorCookie,
      { status_update: "Delivered", remarks: "COD collected at door" },
    );
    assert.equal(delivered.status, 201);
    cod = await getPayment(pool, codDeliveredId);
    assert.equal(cod.payment_status, "Paid");
    assert.ok(cod.paid_at);

    // ...and fails on Returned (reached via the return leg: 3 fails, then
    // Arrived at Branch -> Returned).
    const codReturnedId = await book("COD");
    await walkTo(codReturnedId, [
      "Picked Up",
      "Out for Delivery",
      "Delivery Failed",
      "Out for Delivery",
      "Delivery Failed",
      "Out for Delivery",
      "Delivery Failed",
      "Arrived at Branch",
    ]);
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

test(
  "buyer sees the timeline only up to the 3rd Delivery Failed; staff see the full return leg",
  { skip: !hasDb },
  async () => {
    // Seeded return journey LKO-00000003: 3 Delivery Failed rows then a return
    // leg (Arrived at Branch -> Returned). Buyer (receiver,
    // business 6 = buyer2@linko.test) must be cut off at the 3rd fail; the
    // coordinator sees everything (AGENT_HANDOFF §9.3).
    const PARCEL = "LKO-00000003";

    const buyerCookie = await loginAs("buyer2@linko.test");
    const buyerView = await request(`/api/parcels/${PARCEL}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(buyerView.status, 200, "buyer receives their own parcel");
    assert.equal(
      buyerView.body.current_status,
      "Delivery Failed",
      "buyer status banner stops at the 3rd Delivery Failed",
    );
    assert.equal(buyerView.body.latest_courier_id, null);
    assert.equal(buyerView.body.latest_branch_id, null);
    const buyerStatuses = buyerView.body.tracking_history.map(
      (r) => r.status_update,
    );

    // Exactly 3 Delivery Failed visible, and the LAST row the buyer sees is the
    // 3rd Delivery Failed -- nothing from the return leg leaks.
    assert.equal(
      buyerStatuses.filter((s) => s === "Delivery Failed").length,
      3,
      "buyer sees all three failed attempts",
    );
    assert.equal(
      buyerStatuses[buyerStatuses.length - 1],
      "Delivery Failed",
      "buyer timeline ends at the 3rd Delivery Failed",
    );
    assert.ok(
      !buyerStatuses.includes("Returned"),
      "buyer must not see the terminal Returned scan",
    );
    // The return-leg checkpoints that come AFTER the 3rd fail are hidden. (The
    // forward journey also has Arrived/Departed rows, so we assert on Returned
    // absence + the last-row cutoff above, which together prove truncation.)

    // Coordinator sees the untruncated history, including the return leg.
    const staffCookie = await loginAs("logistics@linko.test");
    const staffView = await request(`/api/parcels/${PARCEL}`, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(staffView.status, 200);
    const staffStatuses = staffView.body.tracking_history.map(
      (r) => r.status_update,
    );
    assert.ok(
      staffStatuses.includes("Returned"),
      "coordinator sees the terminal Returned scan",
    );
    assert.ok(
      staffStatuses.length > buyerStatuses.length,
      "staff history is longer than the buyer's truncated view",
    );
  },
);
