import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Confidentiality of transaction contents, checked with direct API requests:
// only the two parties of an order read its orders, invoices, and the parcel's
// declared value; only the owning wholesaler reads its inventory batches; and
// the marketplace catalog is closed to roles without marketplace duties.
// DB-backed tests skip without DATABASE_URL, same as app.test.js.
const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, { cookie, method = "GET", body } = {}) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();
  await new Promise((resolve) => server.close(resolve));
  return { body: text ? JSON.parse(text) : null, status: response.status, setCookie };
}

async function loginAs(email) {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "Password123!" },
  });
  assert.equal(response.status, 200);
  return response.setCookie.split(";")[0];
}

// Seed accounts: buyer = business 1 (Sunrise), wholesaler = business 2 (Cebu
// Fresh). buyer2 / wholesaler2 are marketplace users with no part in the order.
async function sessions() {
  const emails = {
    buyer: "buyer@linko.test",
    wholesaler: "wholesaler@linko.test",
    otherBuyer: "buyer2@linko.test",
    otherWholesaler: "wholesaler2@linko.test",
    coordinator: "logistics@linko.test",
    courier: "courier@linko.test",
    admin: "admin@linko.test",
  };
  const out = {};
  for (const [name, email] of Object.entries(emails)) out[name] = await loginAs(email);
  return out;
}

const OPERATIONAL = ["admin", "coordinator", "courier"];
const UNRELATED = ["otherBuyer", "otherWholesaler"];

test("catalog reads are limited to buyers and wholesalers", { skip: !hasDb }, async () => {
  const s = await sessions();
  const paths = [
    "/api/products",
    "/api/products/1",
    "/api/categories",
    "/api/categories/options",
    "/api/suppliers",
    "/api/suppliers/2",
  ];
  for (const role of OPERATIONAL) {
    for (const path of paths) {
      const response = await request(path, { cookie: s[role] });
      assert.equal(response.status, 403, `${role} GET ${path}`);
    }
  }
  for (const role of ["buyer", "wholesaler"]) {
    for (const path of ["/api/products", "/api/categories", "/api/suppliers"]) {
      const response = await request(path, { cookie: s[role] });
      assert.equal(response.status, 200, `${role} GET ${path}`);
    }
  }
});

test("order, invoice, and parcel contents are visible only to the sender and receiver", { skip: !hasDb }, async () => {
  const s = await sessions();
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const product = await pool.query(
      `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES (2, 'Confidential Test Product', $1, 100, 20)
       RETURNING product_id`,
      [`CONF-${Date.now()}`],
    );
    productId = product.rows[0].product_id;

    const created = await request("/api/orders", {
      method: "POST",
      cookie: s.buyer,
      body: { tier_id: 1, items: [{ product_id: productId, quantity: 3 }] },
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;
    const patchStatus = (cookie, body) =>
      request(`/api/orders/${orderId}/status`, { method: "PATCH", cookie, body });
    for (const body of [{ status: "accepted" }, { status: "preparing" }, { status: "shipped", weight_kg: 2 }]) {
      const step = await patchStatus(s.wholesaler, body);
      assert.equal(step.status, 200, `wholesaler reaches ${body.status}`);
      assert.equal(step.body.items.length, 1, "a party still gets the full order back");
    }

    // --- Orders -----------------------------------------------------------
    for (const role of OPERATIONAL) {
      assert.equal((await request("/api/orders", { cookie: s[role] })).status, 403, `${role} order list`);
      assert.equal((await request(`/api/orders/${orderId}`, { cookie: s[role] })).status, 403, `${role} order detail`);
    }
    for (const role of UNRELATED) {
      assert.equal((await request(`/api/orders/${orderId}`, { cookie: s[role] })).status, 404, `${role} order detail`);
      const list = await request(`/api/orders?q=${orderId}`, { cookie: s[role] });
      assert.equal(list.status, 200);
      assert.ok(!list.body.items.some((o) => o.order_id === orderId), `${role} order list`);
    }
    let parcelId;
    for (const role of ["buyer", "wholesaler"]) {
      const detail = await request(`/api/orders/${orderId}`, { cookie: s[role] });
      assert.equal(detail.status, 200, `${role} order detail`);
      assert.equal(detail.body.items[0].product_name, "Confidential Test Product");
      assert.equal(detail.body.items[0].quantity, 3);
      parcelId = detail.body.parcel_id;
    }
    assert.ok(parcelId, "shipping created a parcel");

    // --- Invoices ---------------------------------------------------------
    const invoice = await pool.query("SELECT invoice_id FROM invoices WHERE order_id = $1", [orderId]);
    assert.equal(invoice.rows.length, 1, "accepting the order created its invoice");
    const invoicePath = `/api/invoices/${invoice.rows[0].invoice_id}`;
    for (const role of OPERATIONAL) {
      assert.equal((await request("/api/invoices", { cookie: s[role] })).status, 403, `${role} invoice list`);
      assert.equal((await request(invoicePath, { cookie: s[role] })).status, 403, `${role} invoice detail`);
    }
    for (const role of UNRELATED) {
      assert.equal((await request(invoicePath, { cookie: s[role] })).status, 404, `${role} invoice detail`);
    }
    for (const role of ["buyer", "wholesaler"]) {
      const detail = await request(invoicePath, { cookie: s[role] });
      assert.equal(detail.status, 200, `${role} invoice detail`);
      assert.equal(detail.body.order_id, orderId);
    }

    // --- Parcel -----------------------------------------------------------
    const parcelPath = `/api/parcels/${parcelId}`;
    for (const role of ["buyer", "wholesaler"]) {
      const parcel = await request(parcelPath, { cookie: s[role] });
      assert.equal(parcel.status, 200, `${role} parcel detail`);
      assert.equal(parcel.body.declared_value, 300, `${role} sees the declared value`);
    }
    // The parcel waits at branch 1 with no courier, so courier@ (branch 1)
    // sees it through the pickup pool.
    for (const role of OPERATIONAL) {
      const parcel = await request(parcelPath, { cookie: s[role] });
      assert.equal(parcel.status, 200, `${role} parcel detail`);
      assert.ok(!("declared_value" in parcel.body), `${role} must not see the declared value`);
      // Delivery-critical fields stay.
      assert.equal(parcel.body.weight_kg, 2);
      assert.ok(parcel.body.destination_address.street_address);
      assert.ok(parcel.body.receiver.business_name);
      assert.ok("payment" in parcel.body && "shipping_fee" in parcel.body);
      assert.ok(Array.isArray(parcel.body.tracking_history));
    }
    for (const role of UNRELATED) {
      assert.equal((await request(parcelPath, { cookie: s[role] })).status, 404, `${role} parcel detail`);
    }

    // --- Admin override answers without the order's contents ---------------
    const overridden = await patchStatus(s.admin, { status: "delivered" });
    assert.equal(overridden.status, 200);
    assert.deepEqual(overridden.body, { order_id: orderId, status: "delivered" });
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM invoices WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});

test("inventory batches are readable and writable only by the owning wholesaler", { skip: !hasDb }, async () => {
  const s = await sessions();
  const pool = createPool();
  let productId;
  try {
    const product = await pool.query(
      `INSERT INTO products (business_id, product_name, unit_price, stock_quantity)
       VALUES (2, 'Confidential Batch Product', 10, 5)
       RETURNING product_id`,
    );
    productId = product.rows[0].product_id;
    const body = { product_id: productId, batch_number: "CONF-1", expires_on: "2999-01-01" };

    for (const role of [...OPERATIONAL, "buyer", "otherBuyer"]) {
      assert.equal((await request("/api/inventory-batches", { cookie: s[role] })).status, 403, `${role} batch list`);
      assert.equal(
        (await request("/api/inventory-batches", { method: "POST", cookie: s[role], body })).status,
        403,
        `${role} batch create`,
      );
    }
    assert.equal(
      (await request("/api/inventory-batches", { method: "POST", cookie: s.otherWholesaler, body })).status,
      403,
      "a wholesaler cannot add batches to another business's product",
    );

    const created = await request("/api/inventory-batches", { method: "POST", cookie: s.wholesaler, body });
    assert.equal(created.status, 201);
    const path = `/api/inventory-batches/${created.body.batch_id}`;

    for (const role of [...OPERATIONAL, "buyer", "otherWholesaler"]) {
      assert.equal(
        (await request(path, { method: "PATCH", cookie: s[role], body: { depleted: true } })).status,
        403,
        `${role} batch update`,
      );
      assert.equal((await request(path, { method: "DELETE", cookie: s[role] })).status, 403, `${role} batch delete`);
    }
    const foreign = await request(`/api/inventory-batches?product_id=${productId}`, { cookie: s.otherWholesaler });
    assert.equal(foreign.status, 200);
    assert.deepEqual(foreign.body.items, [], "another wholesaler lists none of these batches");
    assert.equal(
      (await request("/api/inventory-batches?business_id=2", { cookie: s.otherWholesaler })).status,
      403,
    );

    const own = await request(`/api/inventory-batches?product_id=${productId}`, { cookie: s.wholesaler });
    assert.equal(own.status, 200);
    assert.equal(own.body.items.length, 1);
    assert.equal((await request(path, { method: "DELETE", cookie: s.wholesaler })).status, 204);
  } finally {
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});
