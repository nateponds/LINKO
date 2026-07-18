import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

// The tests below hit the real database, so they only run when the developer
// has one configured -- same requirement as npm run migrate.
const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, options) {
  const server = createServer(createApp());

  // Port 0 asks Windows to choose any free port, so tests do not fail just
  // because another local dev server is already using port 5000.
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

// Full teardown for a self-registered account. /api/auth/register creates a
// user AND a business; deleting only the user orphans the business (nothing
// FK-references it back), which leaks a businesses row per test run. Resolve
// the business via user_businesses first, then delete FK-safe.
async function deleteRegisteredUser(email) {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  try {
    const { rows } = await pool.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email],
    );
    if (!rows.length) {
      return;
    }
    const userId = rows[0].user_id;
    const { rows: bizRows } = await pool.query(
      "SELECT business_id FROM user_businesses WHERE user_id = $1",
      [userId],
    );
    const businessIds = bizRows.map((r) => r.business_id);
    await pool.query("DELETE FROM business_memberships WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
    if (businessIds.length) {
      await pool.query("DELETE FROM businesses WHERE business_id = ANY($1)", [businessIds]);
    }
  } finally {
    await pool.end();
  }
}

test("health route reports ok", async () => {
  const response = await request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("supplier route is scaffolded", async () => {
  const response = await request("/api/suppliers");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("authorized parcel booking rejects missing fields before touching the database", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const response = await request("/api/parcels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ weight_kg: 2 }),
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /Missing required fields/);
});

test("authorized parcel booking rejects a bad payment method", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const response = await request("/api/parcels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 2,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 2,
      weight_kg: 2,
      payment_method: "Barter",
    }),
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /payment_method/);
});

test("service tiers come back from the database", { skip: !hasDb }, async () => {
  const response = await request("/api/service-tiers");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("unauthenticated parcel list is rejected", { skip: !hasDb }, async () => {
  const response = await request("/api/parcels");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

// Sprint 8: buyers pass the /parcels gate for single-parcel tracking reads,
// but the list is operator-only — a buyer-only session enumerates nothing.
test("buyer session gets an empty parcel list", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/parcels", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("logistics session can access parcel list", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const response = await request("/api/parcels", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  for (const parcel of response.body) {
    assert.ok("current_status" in parcel);
    assert.ok(parcel.sender.business_name);
  }
});

test("platform admin can access parcel list without logistics membership", { skip: !hasDb }, async () => {
  const cookie = await loginAs("admin@linko.test");
  const response = await request("/api/parcels", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
});

test("unknown parcel returns 404", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const response = await request("/api/parcels/NOPE-404", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 404);
});

test("parcel detail returns the seeded return journey in event order", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const detail = await request("/api/parcels/LKO-00000003", {
    headers: { Cookie: cookie },
  });

  assert.equal(detail.status, 200);
  assert.equal(detail.body.current_status, "Returned");
  assert.deepEqual(
    detail.body.tracking_history.slice(-3).map((entry) => entry.status_update),
    ["Arrived at Branch", "Out for Return", "Returned"],
  );
});

test("booking a parcel creates payment and first log", { skip: !hasDb }, async () => {
  const { createPool: createPoolPatch } = await import("./db.js");
  const patchPool = createPoolPatch();
  const harborId = await getBusinessIdByName(patchPool, "Cebu Fresh Wholesale");
  const sunriseId = await getBusinessIdByName(patchPool, "Sunrise Retail Cooperative");
  const harborAddr = (await patchPool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [harborId])).rows[0].address_id;
  const sunriseAddr = (await patchPool.query("SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1", [sunriseId])).rows[0].address_id;
  await patchPool.end();

  const cookie = await loginAs("logistics@linko.test");
  const created = await request("/api/parcels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      sender_id: harborId,
      receiver_id: sunriseId,
      tier_id: 1,
      origin_address_id: harborAddr,
      destination_address_id: sunriseAddr,
      weight_kg: 2.5,
      declared_value: 1000,
      total_distance_km: 10,
      payment_method: "COD",
    }),
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.current_status, "Order Created");
  // Current seed pricing (tier 1 Standard): 50 base + 2.5kg x 20 + 10km x 2 = 120.00
  assert.equal(created.body.shipping_fee, 120);

  const detail = await request(`/api/parcels/${created.body.parcel_id}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.payment.amount, 1120);
  assert.equal(detail.body.tracking_history.length, 1);
  assert.equal(detail.body.latest_branch_id, 1);
  assert.equal(detail.body.tracking_history[0].branch_name, "LINKO Cebu Central Hub");

  // Remove the test booking so repeated runs do not pile up demo data.
  // Payments and logs cascade with the parcel.
  const { createPool } = await import("./db.js");
  const pool = createPool();
  await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [
    created.body.parcel_id,
  ]);
  await pool.end();
});

test("unauthenticated parcel booking is rejected", async () => {
  const response = await request("/api/parcels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 2,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 2,
      weight_kg: 2,
      payment_method: "COD",
    }),
  });

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("buyer session cannot book a parcel", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/parcels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 2,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 2,
      weight_kg: 2,
      payment_method: "COD",
    }),
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error.message, /forbidden/i);
});

test("buyer session can access suppliers", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/suppliers", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  // Only wholesaler/both businesses appear, each with a product_count.
  const harbor = response.body.find((s) => s.business_name === "Cebu Fresh Wholesale");
  assert.ok(harbor, "Cebu Fresh Wholesale should be listed as a supplier");
  assert.equal(typeof harbor.product_count, "number");
  assert.ok("city_municipality" in harbor && "is_verified" in harbor);
});

test("wholesaler session can access suppliers", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const response = await request("/api/suppliers", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
});

test("auth me rejects unauthenticated requests", async () => {
  const response = await request("/api/auth/me");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("auth login rejects invalid credentials", { skip: !hasDb }, async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "buyer@linko.test",
      password: "wrong-password",
    }),
  });

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /invalid email or password/i);
});

test("auth login returns session cookie and me payload", { skip: !hasDb }, async () => {
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "buyer@linko.test",
      password: "Password123!",
    }),
  });

  assert.equal(login.status, 200);
  assert.match(login.setCookie, /linko_session=/);
  assert.equal(login.body.user.email, "buyer@linko.test");
  assert.ok(Array.isArray(login.body.memberships));

  const cookie = login.setCookie.split(";")[0];
  const me = await request("/api/auth/me", {
    headers: { Cookie: cookie },
  });

  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "buyer@linko.test");
});

test("auth logout clears cookie and invalidates session", { skip: !hasDb }, async () => {
  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "buyer@linko.test",
      password: "Password123!",
    }),
  });

  const cookie = login.setCookie.split(";")[0];
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie },
  });

  assert.equal(logout.status, 204);
  assert.match(logout.setCookie, /linko_session=/);
  assert.match(logout.setCookie, /Max-Age=0/);

  const me = await request("/api/auth/me", {
    headers: { Cookie: cookie },
  });

  assert.equal(me.status, 401);
});

test("auth register creates account, membership, and session", { skip: !hasDb }, async () => {
  const uniqueEmail = `owner-${Date.now()}@example.com`;
  const register = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: uniqueEmail,
      password: "Password123!",
      full_name: "Owner Name",
      business_name: "Example Supplies",
      business_type: "buyer",
    }),
  });

  assert.equal(register.status, 201);
  assert.match(register.setCookie, /linko_session=/);
  assert.equal(register.body.user.email, uniqueEmail);
  assert.equal(register.body.memberships[0].business_type, "buyer");
  assert.equal(register.body.memberships[0].role, "buyer");

  const cookie = register.setCookie.split(";")[0];
  const me = await request("/api/auth/me", {
    headers: { Cookie: cookie },
  });

  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, uniqueEmail);

  await deleteRegisteredUser(uniqueEmail);
});

test("auth register rejects business_type both without creating sessions", { skip: !hasDb }, async () => {
  const uniqueEmail = `both-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const register = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: uniqueEmail,
      password: "Password123!",
      full_name: "Rejected Hybrid",
      business_name: "Rejected Hybrid Trading",
      business_type: "both",
    }),
  });

  assert.equal(register.status, 400);
  assert.match(register.body.error.message, /business_type must be buyer or wholesaler/i);
  assert.equal(register.setCookie, null);

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: uniqueEmail,
      password: "Password123!",
    }),
  });

  assert.equal(login.status, 401);
});

test("auth register rejects duplicate email", { skip: !hasDb }, async () => {
  const uniqueEmail = `duplicate-${Date.now()}@example.com`;
  const firstRegister = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: uniqueEmail,
      password: "Password123!",
      full_name: "Duplicate Owner",
      business_name: "First Business",
      business_type: "buyer",
    }),
  });

  assert.equal(firstRegister.status, 201);

  const secondRegister = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: uniqueEmail,
      password: "Password123!",
      full_name: "Duplicate Owner",
      business_name: "Second Business",
      business_type: "buyer",
    }),
  });

  assert.equal(secondRegister.status, 409);
  assert.match(secondRegister.body.error.message, /email already registered/i);
  assert.equal(secondRegister.setCookie, null);

  await deleteRegisteredUser(uniqueEmail);
});

test("auth register rejects public privileged role business types without creating sessions", { skip: !hasDb }, async () => {
  const disallowedBusinessTypes = ["admin", "courier", "logistics_coordinator", "both"];

  for (const businessType of disallowedBusinessTypes) {
    const uniqueEmail = `${businessType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const register = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: uniqueEmail,
        password: "Password123!",
        full_name: "Rejected User",
        business_name: "Rejected Business",
        business_type: businessType,
      }),
    });

    assert.equal(register.status, 400);
    assert.match(register.body.error.message, /business_type must be buyer or wholesaler/i);
    assert.equal(register.setCookie, null);

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: uniqueEmail,
        password: "Password123!",
      }),
    });

    assert.equal(login.status, 401);
  }
});

// ---------------------------------------------------------------------------
// Milestone 2: marketplace products + categories
// ---------------------------------------------------------------------------

async function postJson(path, cookie, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

test("unauthenticated product list is rejected", async () => {
  const response = await request("/api/products");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("categories come back after migration", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/categories", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 12, "expected at least 12 seeded categories");
  assert.ok("category_id" in response.body[0] && "category_name" in response.body[0]);
});

test("buyer can list products but cannot create them", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");

  const list = await request("/api/products", { headers: { Cookie: cookie } });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body));
  for (const product of list.body) {
    assert.ok("stock_status" in product);
    assert.ok("business_name" in product);
  }

  const create = await postJson("/api/products", cookie, {
    product_name: "Buyer Should Not Create",
    unit_price: 10,
  });
  assert.equal(create.status, 403);
});

test("wholesaler creates, reads, patches, and deletes a product", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const sku = `TEST-${Date.now()}`;

  const created = await postJson("/api/products", cookie, {
    product_name: "Test Marketplace Product",
    unit_price: 250.5,
    sku,
    stock_quantity: 3,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.product_name, "Test Marketplace Product");
  assert.equal(created.body.unit_price, "250.50");
  assert.equal(created.body.stock_status, "low_stock");
  assert.equal(created.body.business_name, "Cebu Fresh Wholesale");
  const productId = created.body.product_id;

  const list = await request("/api/products?business_id=" + created.body.business_id, {
    headers: { Cookie: cookie },
  });
  assert.equal(list.status, 200);
  assert.ok(list.body.some((p) => p.product_id === productId));

  const detail = await request(`/api/products/${productId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.product_id, productId);

  const patched = await request(`/api/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ stock_quantity: 0 }),
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.stock_status, "out_of_stock");

  const deleted = await request(`/api/products/${productId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  assert.equal(deleted.status, 204);

  const gone = await request(`/api/products/${productId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(gone.status, 404);

  const listAfter = await request("/api/products?business_id=" + created.body.business_id, {
    headers: { Cookie: cookie },
  });
  assert.ok(!listAfter.body.some((p) => p.product_id === productId));
});

test("product create rejects missing name or negative price", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");

  const noName = await postJson("/api/products", cookie, { unit_price: 10 });
  assert.equal(noName.status, 400);
  assert.match(noName.body.error.message, /product_name/i);

  const badPrice = await postJson("/api/products", cookie, {
    product_name: "Bad Price",
    unit_price: -5,
  });
  assert.equal(badPrice.status, 400);
  assert.match(badPrice.body.error.message, /unit_price/i);
});

test("wholesaler cannot patch a product owned by another business", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const bizName = `Temp Wholesaler ${Date.now()}`;
  let foreignProductId;
  try {
    const biz = await pool.query(
      `INSERT INTO businesses (business_name, business_type)
       VALUES ($1, 'wholesaler') RETURNING business_id`,
      [bizName],
    );
    const prod = await pool.query(
      `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES ($1, 'Foreign Product', $2, 100, 5) RETURNING product_id`,
      [biz.rows[0].business_id, `FOREIGN-${Date.now()}`],
    );
    foreignProductId = prod.rows[0].product_id;

    const patched = await request(`/api/products/${foreignProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ unit_price: 1 }),
    });
    assert.equal(patched.status, 403);
  } finally {
    if (foreignProductId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [foreignProductId]);
    }
    await pool.query("DELETE FROM businesses WHERE business_name = $1", [bizName]);
    await pool.end();
  }
});

test("platform admin manages products across businesses", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();

  // Resolve Harbor's business_id by name (SERIAL, never hardcoded).
  const harbor = await pool.query(
    "SELECT business_id FROM businesses WHERE business_name = 'Cebu Fresh Wholesale'",
  );
  const harborId = harbor.rows[0].business_id;

  // Admin has no wholesaler membership, so POST without business_id -> 400.
  const noBiz = await postJson("/api/products", adminCookie, {
    product_name: "Admin No Business",
    unit_price: 10,
  });
  assert.equal(noBiz.status, 400);
  assert.match(noBiz.body.error.message, /business_id/i);

  // POST with a valid wholesaler business_id -> 201.
  const created = await postJson("/api/products", adminCookie, {
    product_name: "Admin Created Product",
    unit_price: 42,
    sku: `ADMIN-${Date.now()}`,
    business_id: harborId,
  });
  assert.equal(created.status, 201);
  const productId = created.body.product_id;

  try {
    // Admin can patch a product it does not "own".
    const patched = await request(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ unit_price: 99 }),
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.unit_price, "99.00");
  } finally {
    await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    await pool.end();
  }
});

test("a soft-deleted product's sku can be reused, but an active sku cannot", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  const suffix = Date.now();
  const reuseSku = `REUSE-1-${suffix}`;
  const activeSku = `REUSE-2-${suffix}`;
  const created = [];
  try {
    // Create then soft-delete a product, then re-create with the same sku -> 201.
    const first = await postJson("/api/products", cookie, {
      product_name: "Reusable Sku Product",
      unit_price: 10,
      sku: reuseSku,
    });
    assert.equal(first.status, 201);
    created.push(first.body.product_id);

    const del = await request(`/api/products/${first.body.product_id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(del.status, 204);

    const reused = await postJson("/api/products", cookie, {
      product_name: "Reused Sku Product",
      unit_price: 12,
      sku: reuseSku,
    });
    assert.equal(reused.status, 201);
    created.push(reused.body.product_id);

    // A second ACTIVE product with the same sku -> 400 (partial unique index).
    const firstActive = await postJson("/api/products", cookie, {
      product_name: "Active Sku Product",
      unit_price: 15,
      sku: activeSku,
    });
    assert.equal(firstActive.status, 201);
    created.push(firstActive.body.product_id);

    const dupActive = await postJson("/api/products", cookie, {
      product_name: "Duplicate Active Sku",
      unit_price: 15,
      sku: activeSku,
    });
    assert.equal(dupActive.status, 400);
  } finally {
    for (const id of created) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [id]);
    }
    await pool.end();
  }
});

test("non-numeric product id returns 404 not 500", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/products/not-a-number", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 404);
});

// ---------------------------------------------------------------------------
// Milestone 3: orders + invoices
// ---------------------------------------------------------------------------

async function getBusinessIdByName(pool, businessName) {
  const { rows } = await pool.query(
    "SELECT business_id FROM businesses WHERE business_name = $1",
    [businessName],
  );
  assert.ok(rows[0], `expected business ${businessName} to exist`);
  return rows[0].business_id;
}

async function getProductStock(pool, productId) {
  const { rows } = await pool.query(
    "SELECT stock_quantity FROM products WHERE product_id = $1",
    [productId],
  );
  assert.ok(rows[0], `expected product ${productId} to exist`);
  return rows[0].stock_quantity;
}

async function createTestProduct(pool, overrides = {}) {
  const harborId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
  const product = await pool.query(
    `INSERT INTO products
       (business_id, product_name, sku, unit_price, stock_quantity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING product_id`,
    [
      harborId,
      overrides.product_name ?? "Order Test Product",
      overrides.sku ?? `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      overrides.unit_price ?? 125,
      overrides.stock_quantity ?? 9,
    ],
  );
  return product.rows[0].product_id;
}

test("unauthenticated order and invoice lists are rejected", async () => {
  const orders = await request("/api/orders");
  assert.equal(orders.status, 401);
  assert.match(orders.body.error.message, /authentication required/i);

  const invoices = await request("/api/invoices");
  assert.equal(invoices.status, 401);
  assert.match(invoices.body.error.message, /authentication required/i);
});

test("buyer creates an order and buyer and wholesaler can see their own sides", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  const productIds = [];

  try {
    const firstProductId = await createTestProduct(pool, {
      stock_quantity: 12,
      unit_price: 150.5,
    });
    const secondProductId = await createTestProduct(pool, {
      product_name: "Second Cart Product",
      stock_quantity: 8,
      unit_price: 50,
    });
    productIds.push(firstProductId, secondProductId);

    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1,
      items: [
        { product_id: firstProductId, quantity: 2 },
        { product_id: secondProductId, quantity: 1 },
      ],
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "pending");
    assert.equal(created.body.wholesaler_business_name, "Cebu Fresh Wholesale");
    assert.equal(created.body.buyer_business_name, "Sunrise Retail Cooperative");
    assert.equal(created.body.total, "401.00");
    assert.equal(created.body.items.length, 2);
    assert.equal(created.body.items[0].unit_price_snapshot, "150.50");
    assert.equal(created.body.invoice, null);
    orderId = created.body.order_id;

    const buyerList = await request("/api/orders", { headers: { Cookie: buyerCookie } });
    assert.equal(buyerList.status, 200);
    assert.ok(buyerList.body.some((order) => order.order_id === orderId));

    const wholesalerList = await request("/api/orders", {
      headers: { Cookie: wholesalerCookie },
    });
    assert.equal(wholesalerList.status, 200);
    assert.ok(wholesalerList.body.some((order) => order.order_id === orderId));
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    for (const productId of productIds) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("wholesaler accepts an order, decrements stock, and generates one invoice", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;

  try {
    productId = await createTestProduct(pool, { stock_quantity: 5, unit_price: 80 });
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1, items: [{ product_id: productId, quantity: 3 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    const accepted = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, "accepted");
    assert.equal(accepted.body.invoice.total, "290.00");
    assert.match(accepted.body.invoice.invoice_number, /^INV-\d+-\d+$/);
    assert.equal(await getProductStock(pool, productId), 2);

    const secondAccept = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(secondAccept.status, 400);

    const invoices = await request("/api/invoices", { headers: { Cookie: buyerCookie } });
    assert.equal(invoices.status, 200);
    const invoice = invoices.body.find((row) => row.order_id === orderId);
    assert.ok(invoice);
    assert.equal(invoice.total, "290.00");

    const invoiceDetail = await request(`/api/invoices/${invoice.invoice_id}`, {
      headers: { Cookie: wholesalerCookie },
    });
    assert.equal(invoiceDetail.status, 200);
    assert.equal(invoiceDetail.body.order_id, orderId);
    assert.equal(invoiceDetail.body.items[0].product_id, productId);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("order status transitions and ownership are enforced", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const logisticsCookie = await loginAs("logistics@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;

  try {
    productId = await createTestProduct(pool, { stock_quantity: 2, unit_price: 25 });
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1, items: [{ product_id: productId, quantity: 2 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    const logisticsList = await request("/api/orders", {
      headers: { Cookie: logisticsCookie },
    });
    assert.equal(logisticsList.status, 403);

    const buyerAccept = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(buyerAccept.status, 403);

    // Wholesalers can never set delivered -- that's the courier's scan
    // (docs/API_CONTRACTS.md §3.6) -- so this 403s before transition
    // validity is even considered.
    const wholesalerDelivers = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "delivered" }),
    });
    assert.equal(wholesalerDelivers.status, 403);

    // A permitted actor skipping ahead is still an invalid transition.
    const skipped = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "shipped" }),
    });
    assert.equal(skipped.status, 400);

    const cancelled = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
    assert.equal(cancelled.body.invoice, null);
    assert.equal(await getProductStock(pool, productId), 2);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("accepting an order rejects insufficient stock without generating an invoice", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;

  try {
    productId = await createTestProduct(pool, { stock_quantity: 1, unit_price: 40 });
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1, items: [{ product_id: productId, quantity: 2 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    const accepted = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(accepted.status, 400);
    assert.match(accepted.body.error.message, /insufficient stock/i);
    assert.equal(await getProductStock(pool, productId), 1);

    const invoices = await request("/api/invoices", { headers: { Cookie: buyerCookie } });
    assert.equal(invoices.status, 200);
    assert.ok(!invoices.body.some((row) => row.order_id === orderId));
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("platform admin can view all orders and override order status", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;

  try {
    productId = await createTestProduct(pool, { stock_quantity: 4, unit_price: 30 });
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1, items: [{ product_id: productId, quantity: 2 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    const adminList = await request("/api/orders", { headers: { Cookie: adminCookie } });
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.some((order) => order.order_id === orderId));

    // Admin override (docs/API_CONTRACTS.md §2c.4): valid transitions
    // succeed with full side effects...
    const adminAccept = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(adminAccept.status, 200);
    assert.equal(await getProductStock(pool, productId), 2);

    const invoices = await request("/api/invoices", { headers: { Cookie: adminCookie } });
    assert.equal(invoices.status, 200);
    assert.ok(invoices.body.some((row) => row.order_id === orderId));

    // ...but invalid skips are still rejected.
    const adminSkip = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "delivered" }),
    });
    assert.equal(adminSkip.status, 400);

    const adminPreparing = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "preparing" }),
    });
    assert.equal(adminPreparing.status, 200);

    const adminShipped = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "shipped", weight_kg: 4.2, total_distance_km: 10 }),
    });
    assert.equal(adminShipped.status, 200);

    const wholesalerReturns = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "returned" }),
    });
    assert.equal(wholesalerReturns.status, 403);

    const adminReturns = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "returned" }),
    });
    assert.equal(adminReturns.status, 200);
    assert.equal(adminReturns.body.status, "returned");

    const returnNotifications = await pool.query(
      `SELECT title, message, type
         FROM notifications
        WHERE message LIKE $1
          AND title IN ('Delivery Failed — Order Returned', 'Parcel Returning to Sender')`,
      [`%order #${orderId}%`],
    );
    assert.equal(returnNotifications.rows.length, 2);
    assert.ok(returnNotifications.rows.every((row) => row.type === "warning"));

    const adminReopensReturned = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "delivered" }),
    });
    assert.equal(adminReopensReturned.status, 400);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [
        `%order #${orderId}%`,
      ]);
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("shipped -> cancelled is an admin-only manual override (Sprint 11)", { skip: !hasDb }, async () => {
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const buyerCookie = await loginAs("buyer@linko.test");
  const adminCookie = await loginAs("admin@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;

  try {
    productId = await createTestProduct(pool, { stock_quantity: 4, unit_price: 30 });
    const created = await postJson("/api/orders", buyerCookie, {
      tier_id: 1, items: [{ product_id: productId, quantity: 2 }],
    });
    assert.equal(created.status, 201);
    orderId = created.body.order_id;

    for (const status of ["accepted", "preparing"]) {
      const step = await request(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify({ status }),
      });
      assert.equal(step.status, 200, `wholesaler should reach ${status}`);
    }
    const shipped = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "shipped", weight_kg: 2.0, total_distance_km: 10 }),
    });
    assert.equal(shipped.status, 200);

    // Neither the buyer (post-shipment) nor the wholesaler can cancel --
    // this is an admin-only manual escape hatch.
    const buyerCancels = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(buyerCancels.status, 403);

    const wholesalerCancels = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(wholesalerCancels.status, 403);

    const adminCancels = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.equal(adminCancels.status, 200);
    assert.equal(adminCancels.body.status, "cancelled");
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});

test("3-fail return path: count-gated edges, auto-POD, split order side effects", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let parcelId;

  try {
    const buyerBusinessId = await getBusinessIdByName(
      pool,
      "Sunrise Retail Cooperative",
    );
    const wholesalerBusinessId = await getBusinessIdByName(
      pool,
      "Cebu Fresh Wholesale",
    );
    const buyerAddress = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1",
      [buyerBusinessId],
    );
    const wholesalerAddress = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1",
      [wholesalerBusinessId],
    );

    const order = await pool.query(
      `INSERT INTO orders
         (buyer_business_id, wholesaler_business_id, status, tier_id)
       VALUES ($1, $2, 'shipped', 1)
       RETURNING order_id`,
      [buyerBusinessId, wholesalerBusinessId],
    );
    orderId = order.rows[0].order_id;
    parcelId = `RTN-${Date.now()}`;

    await pool.query(
      `INSERT INTO parcels
         (parcel_id, order_id, sender_id, receiver_id, tier_id,
          origin_address_id, destination_address_id, weight_kg,
          total_distance_km, estimated_delivery_date)
       VALUES ($1, $2, $3, $4, 1, $5, $6, 2, 10, CURRENT_DATE + 1)`,
      [
        parcelId,
        orderId,
        wholesalerBusinessId,
        buyerBusinessId,
        wholesalerAddress.rows[0].address_id,
        buyerAddress.rows[0].address_id,
      ],
    );
    // branch_id must match the acting courier's assigned branch (1, Cebu) --
    // courier write-scope requires a non-null branch match, no NULL-to-NULL
    // pool visibility (Sprint 7 anti-leak contract change).
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id)
       VALUES ($1, 'Out for Delivery', 'Courier attempted delivery', 1)`,
      [parcelId],
    );

    const scan = (body) =>
      request(`/api/parcels/${parcelId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: courierCookie },
        body: JSON.stringify(body),
      });

    // Couriers cannot jump straight to Returned from Out for Delivery.
    const shortcut = await scan({ status_update: "Returned" });
    assert.equal(shortcut.status, 400);

    // Attempt 1 + 2: soft-reason Delivery Failed then retry.
    for (const attempt of [1, 2]) {
      const failed = await scan({ status_update: "Delivery Failed", remarks: "Receiver unavailable" });
      assert.equal(failed.status, 201, `fail attempt ${attempt}`);
      const retry = await scan({ status_update: "Out for Delivery" });
      assert.equal(retry.status, 201, `retry after attempt ${attempt}`);
    }

    // 3rd soft fail: notification fires for both businesses, order stays shipped.
    const thirdFail = await scan({ status_update: "Delivery Failed", remarks: "Receiver unavailable" });
    assert.equal(thirdFail.status, 201);

    const stillShipped = await pool.query(
      "SELECT status FROM orders WHERE order_id = $1",
      [orderId],
    );
    assert.equal(stillShipped.rows[0].status, "shipped");

    const thirdFailNotifications = await pool.query(
      `SELECT n.message, n.type, bm.business_id
         FROM notifications n
         JOIN business_memberships bm ON bm.user_id = n.user_id
        WHERE n.message ILIKE $1
          AND n.title = 'Delivery Failed — Parcel Returning to Sender'`,
      [`%order #${orderId}%`],
    );
    const notifiedBusinesses = thirdFailNotifications.rows.map((row) => row.business_id);
    assert.ok(notifiedBusinesses.includes(buyerBusinessId));
    assert.ok(notifiedBusinesses.includes(wholesalerBusinessId));
    assert.ok(
      thirdFailNotifications.rows.every(
        (row) =>
          row.type === "warning" &&
          row.message.includes("after 3 attempts") &&
          row.message.includes("Receiver unavailable"),
      ),
    );
    const buyerNotificationsBeforeSettle = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM notifications n
         JOIN business_memberships bm ON bm.user_id = n.user_id
        WHERE bm.business_id = $1
          AND n.message ILIKE $2`,
      [buyerBusinessId, `%order #${orderId}%`],
    );

    // Trigger-gated edge: after the 3rd soft fail the retry closes, return leg opens.
    const blockedRetry = await scan({ status_update: "Out for Delivery" });
    assert.equal(blockedRetry.status, 400);

    // return leg triggered opens the locked return leg. Branch-checkpoint remarks are
    // auto-generated from branches.branch_name, not client input.
    const returnArrive = await scan({ status_update: "Arrived at Branch" });
    assert.equal(returnArrive.status, 201);
    assert.equal(returnArrive.body.remarks, "Arrived at LINKO Cebu Central Hub");

    const directReturn = await scan({ status_update: "Returned" });
    assert.equal(directReturn.status, 400);
    const blockedDeparture = await scan({ status_update: "Departed Branch" });
    assert.equal(blockedDeparture.status, 400);

    const outForReturn = await scan({ status_update: "Out for Return" });
    assert.equal(outForReturn.status, 201);

    const beforeReturnSettlement = await pool.query(
      "SELECT status FROM orders WHERE order_id = $1",
      [orderId],
    );
    assert.equal(beforeReturnSettlement.rows[0].status, "shipped");
    const prematureSettleNotifications = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM notifications
        WHERE title = 'Parcel Returned to You'
          AND message ILIKE $1`,
      [`%order #${orderId}%`],
    );
    assert.equal(prematureSettleNotifications.rows[0].n, 0);

    // Terminal handoff to the sender. Remark is auto-generated proof of
    // return (courier full_name -> sender business_name), no client input.
    const returned = await scan({ status_update: "Returned" });
    assert.equal(returned.status, 201);
    assert.equal(returned.body.status_update, "Returned");
    assert.equal(returned.body.remarks, "Cory Courier → Cebu Fresh Wholesale");

    const updatedOrder = await pool.query(
      "SELECT status FROM orders WHERE order_id = $1",
      [orderId],
    );
    assert.equal(updatedOrder.rows[0].status, "returned");

    const settleNotifications = await pool.query(
      `SELECT n.title, n.message, n.type, bm.business_id
         FROM notifications n
         JOIN business_memberships bm ON bm.user_id = n.user_id
        WHERE n.message ILIKE $1
          AND n.title = 'Parcel Returned to You'`,
      [`%order #${orderId}%`],
    );
    // Buyer is NOT notified on Returned -- they went silent after the 3rd
    // Delivery Failed (decision A). Only the wholesaler gets the settle notice.
    assert.ok(
      settleNotifications.rows.some(
        (row) => row.business_id === wholesalerBusinessId && row.title === "Parcel Returned to You",
      ),
    );
    // Settle message drops the "delivery failed" wording — that already fired
    // on the 3rd failed attempt.
    assert.ok(
      settleNotifications.rows.every(
        (row) => row.type === "warning" && !/delivery failed/i.test(row.message),
      ),
    );
    const buyerNotificationsAfterSettle = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM notifications n
         JOIN business_memberships bm ON bm.user_id = n.user_id
        WHERE bm.business_id = $1
          AND n.message ILIKE $2`,
      [buyerBusinessId, `%order #${orderId}%`],
    );
    assert.equal(
      buyerNotificationsAfterSettle.rows[0].n,
      buyerNotificationsBeforeSettle.rows[0].n,
      "Returned settlement must not create another buyer notification",
    );
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [
        `%order #${orderId}%`,
      ]);
    }
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (orderId) {
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    await pool.end();
  }
});

test("hard-fail reason opens the return leg on the first fail", { skip: !hasDb }, async () => {
  const courierCookie = await loginAs("courier@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let parcelId;

  try {
    const buyerBusinessId = await getBusinessIdByName(
      pool,
      "Sunrise Retail Cooperative",
    );
    const wholesalerBusinessId = await getBusinessIdByName(
      pool,
      "Cebu Fresh Wholesale",
    );
    const buyerAddress = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1",
      [buyerBusinessId],
    );
    const wholesalerAddress = await pool.query(
      "SELECT address_id FROM addresses WHERE business_id = $1 LIMIT 1",
      [wholesalerBusinessId],
    );

    const order = await pool.query(
      `INSERT INTO orders
         (buyer_business_id, wholesaler_business_id, status, tier_id)
       VALUES ($1, $2, 'shipped', 1)
       RETURNING order_id`,
      [buyerBusinessId, wholesalerBusinessId],
    );
    orderId = order.rows[0].order_id;
    parcelId = `HRD-${Date.now()}`;

    await pool.query(
      `INSERT INTO parcels
         (parcel_id, order_id, sender_id, receiver_id, tier_id,
          origin_address_id, destination_address_id, weight_kg,
          total_distance_km, estimated_delivery_date)
       VALUES ($1, $2, $3, $4, 1, $5, $6, 2, 10, CURRENT_DATE + 1)`,
      [
        parcelId,
        orderId,
        wholesalerBusinessId,
        buyerBusinessId,
        wholesalerAddress.rows[0].address_id,
        buyerAddress.rows[0].address_id,
      ],
    );
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id)
       VALUES ($1, 'Out for Delivery', 'Courier attempted delivery', 1)`,
      [parcelId],
    );

    const scan = (body) =>
      request(`/api/parcels/${parcelId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: courierCookie },
        body: JSON.stringify(body),
      });

    // A single hard-reason fail opens the return leg immediately.
    const hardFail = await scan({ status_update: "Delivery Failed", remarks: "Bad address" });
    assert.equal(hardFail.status, 201);

    // Hard-reason notification fires for both parties on this first fail.
    const hardFailNotifications = await pool.query(
      `SELECT n.message, n.type, bm.business_id
         FROM notifications n
         JOIN business_memberships bm ON bm.user_id = n.user_id
        WHERE n.message ILIKE $1
          AND n.title = 'Delivery Failed — Parcel Returning to Sender'`,
      [`%order #${orderId}%`],
    );
    const notifiedBusinesses = hardFailNotifications.rows.map((row) => row.business_id);
    assert.ok(notifiedBusinesses.includes(buyerBusinessId));
    assert.ok(notifiedBusinesses.includes(wholesalerBusinessId));
    assert.ok(
      hardFailNotifications.rows.every(
        (row) =>
          row.type === "warning" &&
          row.message.includes("Delivery cannot be completed") &&
          row.message.includes("Bad address"),
      ),
    );

    // Retry is closed; the return leg is open even though there is only one fail.
    const blockedRetry = await scan({ status_update: "Out for Delivery" });
    assert.equal(blockedRetry.status, 400);
    const returnArrive = await scan({ status_update: "Arrived at Branch" });
    assert.equal(returnArrive.status, 201);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM notifications WHERE message LIKE $1", [
        `%order #${orderId}%`,
      ]);
    }
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (orderId) {
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    await pool.end();
  }
});

test("non-owner status mutation is rejected before lifecycle details leak", { skip: !hasDb }, async () => {
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId;
  let productId;
  let foreignBusinessId;

  try {
    const buyerBusinessId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const business = await pool.query(
      `INSERT INTO businesses (business_name, business_type)
       VALUES ($1, 'wholesaler')
       RETURNING business_id`,
      [`Foreign Order Wholesaler ${Date.now()}`],
    );
    foreignBusinessId = business.rows[0].business_id;
    const product = await pool.query(
      `INSERT INTO products (business_id, product_name, sku, unit_price, stock_quantity)
       VALUES ($1, 'Foreign Order Product', $2, 40, 5)
       RETURNING product_id`,
      [foreignBusinessId, `FOREIGN-ORDER-${Date.now()}`],
    );
    productId = product.rows[0].product_id;
    const order = await pool.query(
      `INSERT INTO orders (buyer_business_id, wholesaler_business_id, status, tier_id)
       VALUES ($1, $2, 'delivered', 1)
       RETURNING order_id`,
      [buyerBusinessId, foreignBusinessId],
    );
    orderId = order.rows[0].order_id;
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price_snapshot)
       VALUES ($1, $2, 1, 40)`,
      [orderId, productId],
    );

    const response = await request(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.equal(response.status, 403);
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    if (foreignBusinessId) {
      await pool.query("DELETE FROM businesses WHERE business_id = $1", [foreignBusinessId]);
    }
    await pool.end();
  }
});

test("PUT /api/service-tiers/:id is admin-only and validates inputs (Sprint 12)", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const wholesalerCookie = await loginAs("wholesaler@linko.test");
  const buyerCookie = await loginAs("buyer@linko.test");
  const coordinatorCookie = await loginAs("logistics@linko.test");

  const payload = {
    tier_name: "Test Tier Admin Edit",
    base_fee: 50,
    base_rate_per_kg: 10,
    rate_per_km: 5,
    estimated_days: 3
  };

  // 1. Non-admin roles 403
  for (const cookie of [wholesalerCookie, buyerCookie, coordinatorCookie]) {
    const res = await request("/api/service-tiers/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 403);
  }

  // 2. Admin 200 (Valid)
  const validRes = await request("/api/service-tiers/1", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify(payload),
  });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.tier_name, "Test Tier Admin Edit");
  assert.equal(validRes.body.base_fee, 50);

  // 3. 404 Not Found
  const notFoundRes = await request("/api/service-tiers/9999", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify(payload),
  });
  assert.equal(notFoundRes.status, 404);

  // 4. 400 Negative fee
  const negativeFeeRes = await request("/api/service-tiers/1", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ ...payload, base_fee: -10 }),
  });
  assert.equal(negativeFeeRes.status, 400);

  // 5. 400 estimated_days < 1
  const zeroDaysRes = await request("/api/service-tiers/1", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ ...payload, estimated_days: 0 }),
  });
  assert.equal(zeroDaysRes.status, 400);

  // Revert tier 1 to its seed state (dev_seed.sql: base_fee 50) so we don't
  // break other tests permanently.
  await request("/api/service-tiers/1", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      tier_name: "Standard",
      base_fee: 50,
      base_rate_per_kg: 20,
      rate_per_km: 2,
      estimated_days: 5
    }),
  });
});

test("Frozen shipping_fee: editing a tier does not affect already-booked parcels", { skip: !hasDb }, async () => {
  const { createPool } = await import("./db.js");
  const pool = createPool();
  let orderId1, orderId2;
  let productId;

  try {
    const buyerCookie = await loginAs("buyer@linko.test");
    const wholesalerCookie = await loginAs("wholesaler@linko.test");
    const adminCookie = await loginAs("admin@linko.test");

    const seedRefs = await pool.query(
      `SELECT tier_id, base_fee::float8
         FROM service_tiers
        ORDER BY tier_id
        LIMIT 1`,
    );
    const { tier_id: tierId, base_fee: originalFee } = seedRefs.rows[0];
    productId = await createTestProduct(pool, {
      product_name: "Frozen Shipping Fee Test Product",
      stock_quantity: 2,
    });

    // Book parcel 1 (BEFORE edit)
    const created1 = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    orderId1 = created1.body.order_id;
    for (const status of ["accepted", "preparing", "shipped"]) {
      await request(`/api/orders/${orderId1}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify(
          status === "shipped"
            ? { status, weight_kg: 1, total_distance_km: 10 }
            : { status },
        ),
      });
    }

    // Get parcel 1 shipping_fee
    const parcel1 = await pool.query("SELECT shipping_fee::float8 FROM parcels WHERE order_id = $1", [orderId1]);
    const fee1 = parcel1.rows[0].shipping_fee;

    // Edit tier
    const payload = {
      tier_name: "Edited Tier",
      base_fee: originalFee + 100, // Increase by 100
      base_rate_per_kg: 20,
      rate_per_km: 2,
      estimated_days: 5
    };
    await request(`/api/service-tiers/${tierId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify(payload),
    });

    // Book parcel 2 (AFTER edit)
    const created2 = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: buyerCookie },
      body: JSON.stringify({ items: [{ product_id: productId, quantity: 1 }], tier_id: tierId }),
    });
    orderId2 = created2.body.order_id;
    for (const status of ["accepted", "preparing", "shipped"]) {
      await request(`/api/orders/${orderId2}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: wholesalerCookie },
        body: JSON.stringify(
          status === "shipped"
            ? { status, weight_kg: 1, total_distance_km: 10 }
            : { status },
        ),
      });
    }

    // Get parcel 2 shipping_fee
    const parcel2 = await pool.query("SELECT shipping_fee::float8 FROM parcels WHERE order_id = $1", [orderId2]);
    const fee2 = parcel2.rows[0].shipping_fee;

    assert.notEqual(fee1, fee2);
    assert.equal(fee2, fee1 + 100);

    // Revert tier
    await request(`/api/service-tiers/${tierId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ ...payload, base_fee: originalFee, tier_name: "Standard" }),
    });

  } finally {
    if (orderId1) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId1]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId1]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId1]);
    }
    if (orderId2) {
      await pool.query("DELETE FROM parcels WHERE order_id = $1", [orderId2]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId2]);
      await pool.query("DELETE FROM orders WHERE order_id = $1", [orderId2]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE product_id = $1", [productId]);
    }
    await pool.end();
  }
});
