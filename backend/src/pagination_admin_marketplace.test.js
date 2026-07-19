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
  const responseText = await response.text();
  await new Promise((resolve) => server.close(resolve));
  return {
    status: response.status,
    body: responseText ? JSON.parse(responseText) : null,
    setCookie: response.headers.get("set-cookie"),
  };
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

function assertPage(body, expectedPage = 1, expectedLimit = 10) {
  assert.ok(Array.isArray(body.items));
  assert.deepEqual(Object.keys(body.pagination).sort(), [
    "limit",
    "page",
    "total_items",
    "total_pages",
  ]);
  assert.equal(body.pagination.page, expectedPage);
  assert.equal(body.pagination.limit, expectedLimit);
  assert.equal(typeof body.pagination.total_items, "number");
  assert.equal(typeof body.pagination.total_pages, "number");
}

test("admin and marketplace listing routes return pagination envelopes", { skip: !hasDb }, async () => {
  const adminCookie = await loginAs("admin@linko.test");
  const buyerCookie = await loginAs("buyer@linko.test");

  const adminUsers = await request("/api/admin/users?page=1&limit=10", {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminUsers.status, 200);
  assertPage(adminUsers.body);

  const adminBusinesses = await request("/api/admin/businesses?q=logistics", {
    headers: { Cookie: adminCookie },
  });
  assert.equal(adminBusinesses.status, 200);
  assertPage(adminBusinesses.body);

  const logisticsOptions = await request("/api/admin/businesses/options?type=logistics", {
    headers: { Cookie: adminCookie },
  });
  assert.equal(logisticsOptions.status, 200);
  assert.ok(Array.isArray(logisticsOptions.body));
  assert.ok(logisticsOptions.body.every((business) => business.business_type === "logistics"));

  const products = await request("/api/products?stock_status=in_stock", {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(products.status, 200);
  assertPage(products.body);

  const categoryOptions = await request("/api/categories/options", {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(categoryOptions.status, 200);
  assert.ok(Array.isArray(categoryOptions.body));
  assert.ok(categoryOptions.body.every((category) => "category_id" in category && "category_name" in category));

  const suppliers = await request("/api/suppliers?sort=featured", {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(suppliers.status, 200);
  assertPage(suppliers.body);
  assert.ok(suppliers.body.items.length > 0);

  const supplier = suppliers.body.items[0];
  const detail = await request(`/api/suppliers/${supplier.business_id}`, {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.business_id, supplier.business_id);
  assert.equal(typeof detail.body.category_count, "number");

  const categories = await request(`/api/suppliers/${supplier.business_id}/categories?q=`, {
    headers: { Cookie: buyerCookie },
  });
  assert.equal(categories.status, 200);
  assertPage(categories.body);
});

test("marketplace listing filters reject invalid inputs", { skip: !hasDb }, async () => {
  const buyerCookie = await loginAs("buyer@linko.test");
  const headers = { Cookie: buyerCookie };

  for (const path of [
    "/api/products?business_id=nope",
    "/api/products?min_price=10&max_price=2",
    "/api/products?stock_status=unknown",
    "/api/suppliers?category_id=0",
    "/api/suppliers?sort=random",
  ]) {
    const response = await request(path, { headers });
    assert.equal(response.status, 400, path);
  }
});
