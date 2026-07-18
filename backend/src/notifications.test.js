import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Notification producers + unread filtering. DB-backed, skips without
// DATABASE_URL, same as app.test.js. Relies on the dev seed accounts.
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

test("order lifecycle produces unread notifications for the counterparty", { skip: !hasDb }, async () => {
  const pool = createPool();
  let orderId;
  let productId;
  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");

    const seedRefs = await pool.query(
      `SELECT m.business_id, (SELECT MIN(tier_id) FROM service_tiers) AS tier_id
         FROM business_memberships m
         JOIN users u ON u.user_id = m.user_id
        WHERE u.email = 'wholesaler@linko.test' AND m.role = 'wholesaler'
        LIMIT 1`,
    );
    assert.ok(seedRefs.rows[0], "expected a seeded wholesaler business");
    const { business_id: businessId, tier_id: tierId } = seedRefs.rows[0];
    const product = await pool.query(
      `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES ($1, 'Notification Lifecycle Test Product', $2, 100, 1)
       RETURNING product_id`,
      [businessId, `NOTIFICATION-${Date.now()}`],
    );
    productId = product.rows[0].product_id;

    // Buyer places an order -> wholesaler members get "New Order".
    const created = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    const wholesalerNotifs = await request("/api/notifications", {
      headers: { Cookie: wholesalerCookie },
    });
    assert.equal(wholesalerNotifs.status, 200);
    const newOrderNotif = wholesalerNotifs.body.find(
      (n) => n.title === "New Order" && n.message.includes(`#${orderId}`),
    );
    assert.ok(newOrderNotif, "wholesaler should be notified of the new order");
    assert.equal(newOrderNotif.is_read, false);

    // Wholesaler accepts -> buyer members get "Order Accepted".
    const accepted = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(accepted.status, 200);

    const buyerNotifs = await request("/api/notifications", {
      headers: { Cookie: buyerCookie },
    });
    const acceptedNotif = buyerNotifs.body.find(
      (n) => n.title === "Order Accepted" && n.message.includes(`#${orderId}`),
    );
    assert.ok(acceptedNotif, "buyer should be notified the order was accepted");

    // Marking read removes it from the unread feed.
    const markRead = await request(
      `/api/notifications/${acceptedNotif.notification_id}/read`,
      { method: "PATCH", headers: { Cookie: buyerCookie } },
    );
    assert.equal(markRead.status, 200);

    const buyerNotifsAfter = await request("/api/notifications", {
      headers: { Cookie: buyerCookie },
    });
    assert.ok(
      !buyerNotifsAfter.body.some(
        (n) => n.notification_id === acceptedNotif.notification_id,
      ),
      "read notification should not reappear in the unread feed",
    );
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%#${orderId}%`]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});
