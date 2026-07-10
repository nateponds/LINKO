import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

// Milestone 5: business-context + row-level ownership + inventory scoping.
// DB-backed tests skip without DATABASE_URL, same as app.test.js. Each request
// boots the app on port 0 and closes it; helper pools are self-cleaning.
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

async function createParcel(pool, overrides = {}) {
  const senderId =
    overrides.senderId ?? (await getBusinessIdByName(pool, "Cebu Fresh Wholesale"));
  const receiverId =
    overrides.receiverId ?? (await getBusinessIdByName(pool, "Sunrise Retail Cooperative"));
  const originAddressId =
    overrides.originAddressId ?? (await getAddressIdForBusiness(pool, "Cebu Fresh Wholesale"));
  const destinationAddressId =
    overrides.destinationAddressId ??
    (await getAddressIdForBusiness(pool, "Sunrise Retail Cooperative"));
  const parcelId =
    overrides.parcelId ?? `TST-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5)}`;

  await pool.query(
    `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                          origin_address_id, destination_address_id, weight_kg)
     VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
    [parcelId, senderId, receiverId, originAddressId, destinationAddressId],
  );
  return parcelId;
}

async function createNullBranchCourier(pool) {
  const { hashPassword } = await import("./auth/passwords.js");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `nullbranch-${stamp}@linko.test`;
  const password = "Password123!";
  const passwordHash = await hashPassword(password);
  const userId = (
    await pool.query(
      `INSERT INTO users (username, email, full_name, password_hash, role)
       VALUES ($1, $2, 'Null Branch Courier', $3, 'staff')
       RETURNING user_id`,
      [`nullbranch_${stamp}`, email, passwordHash],
    )
  ).rows[0].user_id;
  const businessId = (
    await pool.query(
      `INSERT INTO businesses (business_name, business_type, contact_number)
       VALUES ($1, 'individual', '+639170008888')
       RETURNING business_id`,
      [`Null Branch Courier ${stamp}`],
    )
  ).rows[0].business_id;

  await pool.query("INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)", [
    userId,
    businessId,
  ]);
  await pool.query(
    "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, 'courier')",
    [userId, businessId],
  );
  const courierId = (
    await pool.query(
      `INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id, user_id)
       VALUES ('Null Branch Courier', '+639170008888', 'motorcycle', NULL, $1)
       RETURNING courier_id`,
      [userId],
    )
  ).rows[0].courier_id;

  return { businessId, courierId, email, password, userId };
}

// ---------------------------------------------------------------------------
// Unauthenticated logistics reference reads are now gated (were open).
// ---------------------------------------------------------------------------
test("unauthenticated GET /api/couriers is rejected", async () => {
  const response = await request("/api/couriers");
  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("unauthenticated GET /api/branches is rejected", async () => {
  const response = await request("/api/branches");
  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("a logistics-adjacent role can read couriers and branches", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const couriers = await request("/api/couriers", { headers: { Cookie: cookie } });
  assert.equal(couriers.status, 200);
  assert.ok(Array.isArray(couriers.body));
  const branches = await request("/api/branches", { headers: { Cookie: cookie } });
  assert.equal(branches.status, 200);
  assert.ok(Array.isArray(branches.body));
});

// ---------------------------------------------------------------------------
// Parcel row-level ownership.
// ---------------------------------------------------------------------------
test("wholesaler sees only parcels their business sends or receives", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2 = Cebu Fresh
  const { createPool } = await import("./db.js");
  const pool = createPool();
  try {
    const ownId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const list = await request("/api/parcels", { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    for (const parcel of list.body) {
      const involves =
        parcel.sender.business_id === ownId || parcel.receiver.business_id === ownId;
      assert.ok(involves, "wholesaler should only see parcels involving their business");
    }
  } finally {
    await pool.end();
  }
});

test("wholesaler cannot read a foreign parcel (404)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    // A parcel between two OTHER businesses (Mandaue Agri -> Sunrise), which
    // Cebu Fresh is not part of.
    const senderId = await getBusinessIdByName(pool, "Mandaue Agri Supply");
    const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const senderAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [senderId])
    ).rows[0].address_id;
    const receiverAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [receiverId])
    ).rows[0].address_id;
    parcelId = `TST-${Date.now().toString().slice(-8)}`;
    await pool.query(
      `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                            origin_address_id, destination_address_id, weight_kg)
       VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
      [parcelId, senderId, receiverId, senderAddr, receiverAddr],
    );

    const detail = await request(`/api/parcels/${parcelId}`, { headers: { Cookie: cookie } });
    assert.equal(detail.status, 404);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("logistics coordinator can read any parcel", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    const senderId = await getBusinessIdByName(pool, "Mandaue Agri Supply");
    const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const senderAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [senderId])
    ).rows[0].address_id;
    const receiverAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [receiverId])
    ).rows[0].address_id;
    parcelId = `TST-${Date.now().toString().slice(-8)}`;
    await pool.query(
      `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                            origin_address_id, destination_address_id, weight_kg)
       VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
      [parcelId, senderId, receiverId, senderAddr, receiverAddr],
    );
    const detail = await request(`/api/parcels/${parcelId}`, { headers: { Cookie: cookie } });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.parcel_id, parcelId);
    // Internal ownership-check fields must not leak into the response.
    assert.ok(!("sender_id" in detail.body));
    assert.ok("latest_courier_id" in detail.body);
    assert.ok("latest_branch_id" in detail.body);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("courier pickup pool is scoped to their assigned branch", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const courier2Cookie = await loginAs("courier2@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Branch scoped test', 1, NULL)`,
      [parcelId],
    );

    const branchCourierList = await request("/api/parcels", { headers: { Cookie: courierCookie } });
    assert.equal(branchCourierList.status, 200);
    assert.ok(branchCourierList.body.some((parcel) => parcel.parcel_id === parcelId));

    const otherCourierList = await request("/api/parcels", { headers: { Cookie: courier2Cookie } });
    assert.equal(otherCourierList.status, 200);
    assert.ok(!otherCourierList.body.some((parcel) => parcel.parcel_id === parcelId));

    const visibleDetail = await request(`/api/parcels/${parcelId}`, {
      headers: { Cookie: courierCookie },
    });
    assert.equal(visibleDetail.status, 200);
    assert.equal(visibleDetail.body.latest_branch_id, 1);
    assert.equal(visibleDetail.body.latest_courier_id, null);

    const hiddenDetail = await request(`/api/parcels/${parcelId}`, {
      headers: { Cookie: courier2Cookie },
    });
    assert.equal(hiddenDetail.status, 404);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("branchless pool is invisible to a null-branch courier", { skip: !hasDb }, async () => {
  const branchCourierCookie = await loginAs("courier@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  let nullCourier;
  try {
    nullCourier = await createNullBranchCourier(pool);
    const nullBranchCookie = await loginAs(nullCourier.email, nullCourier.password);
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Branchless pool test', NULL, NULL)`,
      [parcelId],
    );

    const branchCourierList = await request("/api/parcels", {
      headers: { Cookie: branchCourierCookie },
    });
    assert.ok(!branchCourierList.body.some((parcel) => parcel.parcel_id === parcelId));

    // Sprint 7 anti-leak/pool-strictness: a courier with no assigned branch
    // gets no pool clause at all, so a branchless-latest-log parcel is never
    // visible to them -- only parcels in their own handling history are.
    const nullCourierList = await request("/api/parcels", {
      headers: { Cookie: nullBranchCookie },
    });
    assert.ok(!nullCourierList.body.some((parcel) => parcel.parcel_id === parcelId));
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (nullCourier) {
      await pool.query("DELETE FROM couriers WHERE courier_id = $1", [nullCourier.courierId]);
      await pool.query("DELETE FROM business_memberships WHERE user_id = $1", [nullCourier.userId]);
      await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [nullCourier.userId]);
      await pool.query("DELETE FROM user_businesses WHERE user_id = $1", [nullCourier.userId]);
      await pool.query("DELETE FROM businesses WHERE business_id = $1", [nullCourier.businessId]);
      await pool.query("DELETE FROM users WHERE user_id = $1", [nullCourier.userId]);
    }
    await pool.end();
  }
});

test("courier history survives reassignment and unassign returns parcel to branch pool", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const courier2Cookie = await loginAs("courier2@linko.test");
  const logisticsCookie = await loginAs("logistics@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Starts in Cebu pool', 1, NULL)`,
      [parcelId],
    );

    const pickedUp = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Picked Up" }),
    });
    assert.equal(pickedUp.status, 201);
    assert.equal(pickedUp.body.courier_id, 1);
    assert.equal(pickedUp.body.branch_id, 1);

    const reassigned = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: logisticsCookie },
      body: JSON.stringify({ status_update: "In Transit", branch_id: 2, courier_id: 2 }),
    });
    assert.equal(reassigned.status, 201);

    const courierAList = await request("/api/parcels", { headers: { Cookie: courierCookie } });
    assert.ok(courierAList.body.some((parcel) => parcel.parcel_id === parcelId));
    const courierADetail = await request(`/api/parcels/${parcelId}`, {
      headers: { Cookie: courierCookie },
    });
    assert.equal(courierADetail.status, 200);

    const courierBList = await request("/api/parcels", { headers: { Cookie: courier2Cookie } });
    assert.ok(courierBList.body.some((parcel) => parcel.parcel_id === parcelId));

    const unassigned = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: logisticsCookie },
      body: JSON.stringify({ status_update: "In Transit", branch_id: 2 }),
    });
    assert.equal(unassigned.status, 201);
    assert.equal(unassigned.body.branch_id, 2);
    assert.equal(unassigned.body.courier_id, null);

    const branchPoolList = await request("/api/parcels", { headers: { Cookie: courier2Cookie } });
    const pooled = branchPoolList.body.find((parcel) => parcel.parcel_id === parcelId);
    assert.ok(pooled);
    assert.equal(pooled.latest_courier_id, null);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("tracking updates carry forward branch and couriers cannot spoof branch", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const logisticsCookie = await loginAs("logistics@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    parcelId = await createParcel(pool);
    // Pool branch is 1 (Cebu) so courier@ (assigned branch 1) is actually in
    // scope to act on this parcel -- Sprint 7 anti-leak contract requires a
    // real non-null branch match, no NULL-to-NULL or cross-branch access.
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Starts in Cebu pool', 1, NULL)`,
      [parcelId],
    );

    const coordinatorRemark = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: logisticsCookie },
      body: JSON.stringify({ status_update: "In Transit", remarks: "No assignment fields" }),
    });
    assert.equal(coordinatorRemark.status, 201);
    assert.equal(coordinatorRemark.body.branch_id, 1);
    assert.equal(coordinatorRemark.body.courier_id, null);

    // Courier claims a spoofed branch_id (2) in the body; the server must
    // ignore it and stamp their own actual assigned branch (1) instead.
    const courierScan = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "In Transit", branch_id: 2 }),
    });
    assert.equal(courierScan.status, 201);
    assert.equal(courierScan.body.courier_id, 1);
    assert.equal(courierScan.body.branch_id, 1);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("courier cannot backtrack a parcel status", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let parcelId;
  try {
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Starts in Cebu pool', 1, NULL)`,
      [parcelId],
    );

    const pickedUp = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Picked Up" }),
    });
    assert.equal(pickedUp.status, 201);

    const outForDelivery = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Out for Delivery" }),
    });
    assert.equal(outForDelivery.status, 201);

    const backtrack = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Picked Up" }),
    });
    assert.equal(backtrack.status, 400);
    assert.match(backtrack.body.error.message, /cannot move backward/i);

    const latest = await pool.query(
      `SELECT status_update
         FROM tracking_logs
        WHERE parcel_id = $1
        ORDER BY scanned_at DESC, log_id DESC
        LIMIT 1`,
      [parcelId],
    );
    assert.equal(latest.rows[0].status_update, "Out for Delivery");
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

// ---------------------------------------------------------------------------
// X-Active-Business header validation.
// ---------------------------------------------------------------------------
test("X-Active-Business naming a non-member business is rejected (403)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // member of business 2 only
  const { createPool } = await import("./db.js");
  const pool = createPool();
  try {
    const foreignId = await getBusinessIdByName(pool, "Mandaue Agri Supply"); // business 7
    const response = await request("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Active-Business": String(foreignId),
      },
      body: JSON.stringify({ product_name: "Should Fail", unit_price: 5 }),
    });
    assert.equal(response.status, 403);
    assert.match(response.body.error.message, /selected business/i);
  } finally {
    await pool.end();
  }
});

test("X-Active-Business matching a member business is honored on product create", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let productId;
  try {
    const ownId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const created = await request("/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-Active-Business": String(ownId),
      },
      body: JSON.stringify({
        product_name: "Active Business Product",
        unit_price: 12,
        sku: `ACTBIZ-${Date.now()}`,
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.business_id, ownId);
    productId = created.body.product_id;
  } finally {
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

// ---------------------------------------------------------------------------
// POST /api/parcels sender spoofing.
// ---------------------------------------------------------------------------
test("wholesaler cannot spoof sender_id when booking a parcel", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2
  const { createPool } = await import("./db.js");
  const pool = createPool();
  try {
    const foreignSender = await getBusinessIdByName(pool, "Mandaue Agri Supply"); // 7
    const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const senderAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [foreignSender])
    ).rows[0].address_id;
    const receiverAddr = (
      await pool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [receiverId])
    ).rows[0].address_id;

    const response = await request("/api/parcels", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        sender_id: foreignSender,
        receiver_id: receiverId,
        tier_id: 1,
        origin_address_id: senderAddr,
        destination_address_id: receiverAddr,
        weight_kg: 2,
        payment_method: "COD",
      }),
    });
    assert.equal(response.status, 403);
    assert.match(response.body.error.message, /sender_id must be your own business/i);
  } finally {
    await pool.end();
  }
});

// ---------------------------------------------------------------------------
// GET /api/inventory scoping.
// ---------------------------------------------------------------------------
test("inventory returns only the caller's own business rows; admin sees all", { skip: !hasDb }, async () => {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const { hashPassword } = await import("./auth/passwords.js");
  // Everything below is created under a THROWAWAY business so this test never
  // writes to the seeded "Cebu Fresh Wholesale" rows. node --test runs test
  // files as parallel processes, and a stray inventory row on a seeded business
  // would intermittently break app.test.js's "wholesaler session can access
  // inventory" assertion (deepEqual []). Kept fully self-contained + torn down.
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = "InvScope123!";
  let userId;
  let businessId;
  let addressId;
  let warehouseId;
  let productId;
  let itemId;
  try {
    const passwordHash = await hashPassword(password);
    userId = (
      await pool.query(
        `INSERT INTO users (username, email, full_name, password_hash, role)
         VALUES ($1, $2, 'Inventory Scope User', $3, 'wholesaler') RETURNING user_id`,
        [`invscope_${stamp}`, `invscope-${stamp}@linko.test`, passwordHash],
      )
    ).rows[0].user_id;
    businessId = (
      await pool.query(
        `INSERT INTO businesses (business_name, business_type, contact_number, is_verified)
         VALUES ($1, 'wholesaler', '+639170009999', TRUE) RETURNING business_id`,
        [`Inventory Scope Wholesale ${stamp}`],
      )
    ).rows[0].business_id;
    await pool.query(
      "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
      [userId, businessId],
    );
    await pool.query(
      "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, 'wholesaler')",
      [userId, businessId],
    );
    addressId = (
      await pool.query(
        `INSERT INTO addresses (business_id, province, city_municipality, barangay, street_address, postal_code)
         VALUES ($1, 'Cebu', 'Cebu City', 'Lahug', 'Inventory Scope St', '6000') RETURNING address_id`,
        [businessId],
      )
    ).rows[0].address_id;
    warehouseId = (
      await pool.query(
        `INSERT INTO warehouses (business_id, warehouse_name, address_id)
         VALUES ($1, 'Inventory Scope Warehouse', $2) RETURNING warehouse_id`,
        [businessId, addressId],
      )
    ).rows[0].warehouse_id;
    productId = (
      await pool.query(
        `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
         VALUES ($1, 'Inventory Scope Product', $2, 10, 5) RETURNING product_id`,
        [businessId, `INVSCOPE-${stamp}`],
      )
    ).rows[0].product_id;
    itemId = (
      await pool.query(
        `INSERT INTO inventory_items (product_id, warehouse_id, quantity, unit, reorder_threshold)
         VALUES ($1, $2, 100, 'pcs', 20) RETURNING item_id`,
        [productId, warehouseId],
      )
    ).rows[0].item_id;

    // Owner (the throwaway wholesaler) sees the item, in contract shape.
    const ownerCookie = await loginAs(`invscope-${stamp}@linko.test`, password);
    const ownerList = await request("/api/inventory", { headers: { Cookie: ownerCookie } });
    assert.equal(ownerList.status, 200);
    const found = ownerList.body.find((row) => row.item_id === itemId);
    assert.ok(found, "owner should see their own inventory item");
    assert.equal(found.status, "In Stock");
    assert.equal(found.warehouse.warehouse_id, warehouseId);
    assert.ok("city" in found.warehouse);
    assert.equal(found.product.product_id, productId);

    // A different, unrelated wholesaler (seeded business 7) must NOT see it.
    const otherCookie = await loginAs("wholesaler2@linko.test");
    const otherList = await request("/api/inventory", { headers: { Cookie: otherCookie } });
    assert.equal(otherList.status, 200);
    assert.ok(!otherList.body.some((row) => row.item_id === itemId));

    // Platform admin sees all inventory, including this item.
    const adminCookie = await loginAs("admin@linko.test");
    const adminList = await request("/api/inventory", { headers: { Cookie: adminCookie } });
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.some((row) => row.item_id === itemId));
  } finally {
    // FK-safe teardown order: transactions -> items -> products -> warehouses
    // -> addresses -> memberships/sessions/user_businesses -> business -> user.
    if (itemId) {
      await pool.query("DELETE FROM inventory_transactions WHERE item_id = $1", [itemId]);
      await pool.query("DELETE FROM inventory_items WHERE item_id = $1", [itemId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    if (warehouseId) {
      await pool.query("DELETE FROM warehouses WHERE warehouse_id = $1", [warehouseId]);
    }
    if (addressId) {
      await pool.query("DELETE FROM addresses WHERE address_id = $1", [addressId]);
    }
    if (userId) {
      await pool.query("DELETE FROM business_memberships WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);
    }
    if (businessId) {
      await pool.query("DELETE FROM businesses WHERE business_id = $1", [businessId]);
    }
    if (userId) {
      await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
    }
    await pool.end();
  }
});
