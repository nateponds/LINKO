import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, options) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const setCookie = response.headers.get("set-cookie");
    const text = await response.text();
    return {
      body: text ? JSON.parse(text) : null,
      status: response.status,
      setCookie,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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

function sendJson(path, cookie, method, body) {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

test("unauthenticated inventory batch list is rejected", async () => {
  const response = await request("/api/inventory-batches");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("buyer cannot manage inventory expiry batches", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/inventory-batches", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 403);
});

test("wholesaler manages and filters batch expiry records", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const pool = createPool();
  let productId;

  try {
    const product = await sendJson("/api/products", cookie, "POST", {
      product_name: `Expiry Test Product ${Date.now()}`,
      sku: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      unit_price: 20,
      stock_quantity: 12,
    });
    assert.equal(product.status, 201);
    productId = product.body.product_id;

    const invalid = await sendJson("/api/inventory-batches", cookie, "POST", {
      product_id: productId,
      batch_number: "INVALID-DATES",
      manufactured_on: "2027-01-02",
      expires_on: "2027-01-01",
    });
    assert.equal(invalid.status, 400);
    assert.match(invalid.body.error.message, /manufactured_on/i);

    const expired = await sendJson("/api/inventory-batches", cookie, "POST", {
      product_id: productId,
      batch_number: "OLD-LOT",
      manufactured_on: "1999-12-01",
      received_on: "1999-12-15",
      expires_on: "2000-01-01",
      notes: "Test expired batch",
    });
    assert.equal(expired.status, 201);
    assert.equal(expired.body.expiry_status, "expired");
    assert.ok(expired.body.days_until_expiry < 0);

    const fresh = await sendJson("/api/inventory-batches", cookie, "POST", {
      product_id: productId,
      batch_number: "FUTURE-LOT",
      expires_on: "2999-01-01",
    });
    assert.equal(fresh.status, 201);
    assert.equal(fresh.body.expiry_status, "fresh");

    const duplicate = await sendJson("/api/inventory-batches", cookie, "POST", {
      product_id: productId,
      batch_number: "FUTURE-LOT",
      expires_on: "2999-02-01",
    });
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.error.message, /unique/i);

    const expiredList = await request(
      `/api/inventory-batches?product_id=${productId}&status=expired&days=14`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(expiredList.status, 200);
    assert.equal(expiredList.body.expiry_window_days, 14);
    assert.deepEqual(expiredList.body.items.map((batch) => batch.batch_id), [expired.body.batch_id]);

    const depleted = await sendJson(
      `/api/inventory-batches/${expired.body.batch_id}`,
      cookie,
      "PATCH",
      { depleted: true },
    );
    assert.equal(depleted.status, 200);
    assert.equal(depleted.body.expiry_status, "depleted");
    assert.ok(depleted.body.depleted_at);

    const depletedList = await request(
      `/api/inventory-batches?product_id=${productId}&status=depleted`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(depletedList.status, 200);
    assert.deepEqual(depletedList.body.items.map((batch) => batch.batch_id), [expired.body.batch_id]);

    const removed = await request(`/api/inventory-batches/${fresh.body.batch_id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(removed.status, 204);
  } finally {
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("expiry boundaries, date validation, and stock independence", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const pool = createPool();
  let productId;
  try {
    const product = await sendJson("/api/products", cookie, "POST", {
      product_name: "Expiry boundary test", unit_price: 10, stock_quantity: 9,
    });
    assert.equal(product.status, 201);
    productId = product.body.product_id;
    const { rows: dates } = await pool.query(`SELECT
      d::text AS today, (d + 30)::text AS boundary, (d + 31)::text AS later
      FROM (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date AS d) manila`);
    for (const [key, expected] of [["today", "expiring_soon"], ["boundary", "expiring_soon"], ["later", "fresh"]]) {
      const batch = await sendJson("/api/inventory-batches", cookie, "POST", {
        product_id: productId, batch_number: key, expires_on: dates[0][key],
      });
      assert.equal(batch.status, 201);
      assert.equal(batch.body.expires_on, dates[0][key]);
      assert.equal(batch.body.expiry_status, expected);
    }
    const list = await request(`/api/inventory-batches?product_id=${productId}&status=expiring_soon`, { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.items.map((batch) => batch.batch_number), ["today", "boundary"]);
    const batchId = list.body.items[0].batch_id;
    for (const body of [
      { expires_on: "2026-02-30" }, { expires_on: null },
      { batch_number: "  " }, { depleted: "yes" },
      { product_id: productId }, { notes: "x".repeat(1001) },
      { manufactured_on: "2999-01-01" },
    ]) {
      const bad = await sendJson(`/api/inventory-batches/${batchId}`, cookie, "PATCH", body);
      assert.equal(bad.status, 400, JSON.stringify(body));
    }
    // Mutation responses use the caller's ?days= window, like GET does.
    const narrowed = await sendJson(`/api/inventory-batches/${list.body.items[1].batch_id}?days=0`, cookie, "PATCH", { notes: "window check" });
    assert.equal(narrowed.status, 200);
    assert.equal(narrowed.body.expiry_status, "fresh");
    for (const query of ["days=-1", "days=3651", "status=unknown", "days=7&days=14", "product_id=abc"]) {
      const bad = await request(`/api/inventory-batches?${query}`, { headers: { Cookie: cookie } });
      assert.equal(bad.status, 400, query);
    }
    const depleted = await sendJson(`/api/inventory-batches/${batchId}`, cookie, "PATCH", { depleted: true });
    assert.equal(depleted.status, 200);
    const restored = await sendJson(`/api/inventory-batches/${batchId}`, cookie, "PATCH", { depleted: false });
    assert.equal(restored.body.expiry_status, "expiring_soon");
    assert.equal(restored.body.depleted_at, null);
    const stock = await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1", [productId]);
    assert.equal(stock.rows[0].stock_quantity, 9);
  } finally {
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});

test("expiry records enforce business ownership and allow administrator access", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const admin = await loginAs("admin@linko.test");
  const pool = createPool();
  let businessId;
  let productId;
  try {
    const business = await pool.query("INSERT INTO businesses (business_name, business_type) VALUES ('Expiry foreign business', 'wholesaler') RETURNING business_id");
    businessId = business.rows[0].business_id;
    const product = await pool.query("INSERT INTO products (business_id, product_name) VALUES ($1, 'Foreign expiry product') RETURNING product_id", [businessId]);
    productId = product.rows[0].product_id;
    const body = { product_id: productId, batch_number: "FOREIGN", expires_on: "2999-01-01" };
    assert.equal((await sendJson("/api/inventory-batches", cookie, "POST", body)).status, 403);
    const created = await sendJson("/api/inventory-batches", admin, "POST", body);
    assert.equal(created.status, 201);
    const path = `/api/inventory-batches/${created.body.batch_id}`;
    assert.equal((await sendJson(path, cookie, "PATCH", { depleted: true })).status, 403);
    assert.equal((await request(path, { method: "DELETE", headers: { Cookie: cookie } })).status, 403);
    assert.equal((await request(`/api/inventory-batches?business_id=${businessId}`, { headers: { Cookie: cookie } })).status, 403);
    const scoped = await request(`/api/inventory-batches?product_id=${productId}`, { headers: { Cookie: cookie } });
    assert.equal(scoped.status, 200);
    assert.deepEqual(scoped.body.items, []);
    const adminList = await request(`/api/inventory-batches?business_id=${businessId}`, { headers: { Cookie: admin } });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.pagination.total_items, 1);
    await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    productId = null;
    const orphan = await pool.query("SELECT batch_id FROM inventory_batches WHERE batch_id = $1", [created.body.batch_id]);
    assert.equal(orphan.rows.length, 0);
  } finally {
    if (productId) await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    if (businessId) await pool.query("DELETE FROM businesses WHERE business_id = $1", [businessId]);
    await pool.end();
  }
});
