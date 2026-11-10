import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

// RBAC D1 (active business decides) + the Airbnb model (order side comes from
// the order, not the caller's role) + D7 (dashboard = active wholesaler's sales).
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

async function businessIds(pool) {
  const { rows } = await pool.query(
    "SELECT business_name, business_id FROM businesses WHERE business_name = ANY($1::text[])",
    [["Sunrise Retail Cooperative", "Cebu Fresh Wholesale", "Mandaue Agri Supply"]],
  );
  const byName = Object.fromEntries(rows.map((row) => [row.business_name, row.business_id]));
  return {
    sunrise: byName["Sunrise Retail Cooperative"], // buyer
    cebuFresh: byName["Cebu Fresh Wholesale"], // wholesaler@linko.test
    mandaue: byName["Mandaue Agri Supply"], // another wholesaler
  };
}

async function insertOrder(pool, buyerId, wholesalerId) {
  const { rows } = await pool.query(
    `INSERT INTO orders (buyer_business_id, wholesaler_business_id, tier_id, status)
     VALUES ($1, $2, (SELECT MIN(tier_id) FROM service_tiers), 'pending')
     RETURNING order_id`,
    [buyerId, wholesalerId],
  );
  return rows[0].order_id;
}

test("a wholesaler business sees and can cancel an order it placed as buyer", { skip: !hasDb }, async () => {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  try {
    const ids = await businessIds(pool);
    orderId = await insertOrder(pool, ids.cebuFresh, ids.mandaue);
    const cookie = await loginAs("wholesaler@linko.test");

    const list = await request(`/api/orders?q=${orderId}`, { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.ok(list.body.items.some((order) => order.order_id === orderId));

    const detail = await request(`/api/orders/${orderId}`, { headers: { Cookie: cookie } });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.buyer_business_id, ids.cebuFresh);

    const cancelled = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
  } finally {
    if (orderId) await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    await pool.end();
  }
});

// bizswitch@linko.test: buyer on business 8, wholesaler on business 10. The
// wholesaler role on the unselected business must grant nothing.
test("a buyer-active multi-business user is forbidden on a wholesaler-only route", { skip: !hasDb }, async () => {
  const cookie = await loginAs("bizswitch@linko.test");
  const response = await request("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Active-Business": "8" },
    body: JSON.stringify({ product_name: "Should Fail", unit_price: 5 }),
  });
  assert.equal(response.status, 403);
});

test("dashboard counts the active wholesaler's sales, not its purchases", { skip: !hasDb }, async () => {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const orderIds = [];
  try {
    const ids = await businessIds(pool);
    const cookie = await loginAs("wholesaler@linko.test");
    const before = await request("/api/dashboard", { headers: { Cookie: cookie } });
    assert.equal(before.status, 200);

    orderIds.push(await insertOrder(pool, ids.cebuFresh, ids.mandaue)); // purchase
    orderIds.push(await insertOrder(pool, ids.sunrise, ids.cebuFresh)); // sale

    const after = await request("/api/dashboard", { headers: { Cookie: cookie } });
    assert.equal(after.body.orders, before.body.orders + 1);
    assert.equal(after.body.actionableOrders.pending, before.body.actionableOrders.pending + 1);
    const recentIds = after.body.recentActivity.map((row) => row.order_id);
    assert.ok(recentIds.includes(orderIds[1]));
    assert.ok(!recentIds.includes(orderIds[0]));
  } finally {
    if (orderIds.length) {
      await pool.query("DELETE FROM orders WHERE order_id = ANY($1::int[])", [orderIds]);
    }
    await pool.end();
  }
});
