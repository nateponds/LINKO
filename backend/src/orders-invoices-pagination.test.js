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
  const text = await response.text();
  await new Promise((resolve) => server.close(resolve));
  return { status: response.status, body: text ? JSON.parse(text) : null, setCookie: response.headers.get("set-cookie") };
}

async function loginAs(email) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password123!" }),
  });
  assert.equal(response.status, 200);
  return response.setCookie.split(";")[0];
}

test("orders and invoices lists paginate, filter, and remain lean while details retain items", { skip: !hasDb }, async () => {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const buyerCookie = await loginAs("buyer@linko.test");
  let orderId;
  let invoiceId;
  let productId;

  try {
    const { rows: [buyer] } = await pool.query(
      `SELECT m.business_id, u.user_id
         FROM users u
         JOIN business_memberships m ON m.user_id = u.user_id
        WHERE u.email = 'buyer@linko.test' AND m.role = 'buyer'`,
    );
    const { rows: [wholesaler] } = await pool.query(
      `SELECT m.business_id
         FROM users u
         JOIN business_memberships m ON m.user_id = u.user_id
        WHERE u.email = 'wholesaler@linko.test' AND m.role = 'wholesaler'`,
    );
    const { rows: [tier] } = await pool.query("SELECT tier_id FROM service_tiers ORDER BY tier_id LIMIT 1");
    const unique = `pagination-${Date.now()}`;
    const product = await pool.query(
      `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES ($1, $2, $3, 12.50, 10)
       RETURNING product_id`,
      [wholesaler.business_id, unique, unique],
    );
    productId = product.rows[0].product_id;
    const order = await pool.query(
      `INSERT INTO orders (buyer_business_id, wholesaler_business_id, tier_id, status, created_by)
       VALUES ($1, $2, $3, 'accepted', $4)
       RETURNING order_id`,
      [buyer.business_id, wholesaler.business_id, tier.tier_id, buyer.user_id],
    );
    orderId = order.rows[0].order_id;
    await pool.query(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price_snapshot) VALUES ($1, $2, 2, 12.50)",
      [orderId, productId],
    );
    const invoice = await pool.query(
      `INSERT INTO invoices (order_id, invoice_number, total)
       VALUES ($1, $2, 25.00)
       RETURNING invoice_id`,
      [orderId, `INV-${unique}`],
    );
    invoiceId = invoice.rows[0].invoice_id;

    const orderList = await request(`/api/orders?status=accepted&q=${unique}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(orderList.status, 200);
    assert.equal(orderList.body.pagination.total_items, 1);
    assert.equal(orderList.body.items[0].order_id, orderId);
    assert.equal(orderList.body.items[0].item_count, 1);
    assert.equal("items" in orderList.body.items[0], false);

    const emptyOrderPage = await request(`/api/orders?page=50&q=${unique}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.deepEqual(emptyOrderPage.body, {
      items: [],
      pagination: { page: 50, limit: 10, total_items: 1, total_pages: 1 },
    });

    const orderDetail = await request(`/api/orders/${orderId}`, { headers: { Cookie: buyerCookie } });
    assert.equal(orderDetail.status, 200);
    assert.equal(orderDetail.body.items.length, 1);

    const invoiceList = await request(`/api/invoices?status=accepted&q=INV-${unique}`, {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(invoiceList.status, 200);
    assert.equal(invoiceList.body.pagination.total_items, 1);
    assert.equal(invoiceList.body.items[0].invoice_id, invoiceId);
    assert.equal("items" in invoiceList.body.items[0], false);

    const invoiceDetail = await request(`/api/invoices/${invoiceId}`, { headers: { Cookie: buyerCookie } });
    assert.equal(invoiceDetail.status, 200);
    assert.equal(invoiceDetail.body.items.length, 1);

    const invalidStatus = await request("/api/orders?status=not-a-status", {
      headers: { Cookie: buyerCookie },
    });
    assert.equal(invalidStatus.status, 400);
  } finally {
    if (orderId) await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});
