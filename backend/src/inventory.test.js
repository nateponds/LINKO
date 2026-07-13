import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";

// Sprint 10: inventory write contract (POST/PATCH /api/inventory) and the
// GET /api/warehouses picker lookup. DB-backed tests skip without
// DATABASE_URL, same as app.test.js. Seed data assumed (backend/seeds):
// wholesaler@linko.test -> business 2 -> warehouse "Cebu Fresh Main Warehouse";
// wholesaler2@linko.test -> business 7 -> "Mandaue Agri Cold Storage".
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

function jsonPost(cookie, body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  };
}

function jsonPatch(cookie, body) {
  return {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  };
}

async function openPool() {
  const { createPool } = await import("./db.js");
  return createPool();
}

async function getWarehouseIdByName(pool, name) {
  const { rows } = await pool.query(
    "SELECT warehouse_id FROM warehouses WHERE warehouse_name = $1",
    [name],
  );
  assert.ok(rows[0], `expected warehouse ${name} to exist`);
  return rows[0].warehouse_id;
}

// A product owned by the given business (POST only requires the FK to exist,
// but picking the owner's product keeps the fixture realistic).
async function getProductIdForBusiness(pool, businessId) {
  const { rows } = await pool.query(
    "SELECT product_id FROM products WHERE business_id = $1 ORDER BY product_id LIMIT 1",
    [businessId],
  );
  assert.ok(rows[0], `expected business ${businessId} to have a product`);
  return rows[0].product_id;
}

async function deleteItem(pool, itemId) {
  // inventory_transactions rows cascade on item delete.
  await pool.query("DELETE FROM inventory_items WHERE item_id = $1", [itemId]);
}

// ---------------------------------------------------------------------------
// Auth and role gates.
// ---------------------------------------------------------------------------
test("unauthenticated POST /api/inventory is rejected", async () => {
  const response = await request("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 401);
});

test("buyer cannot POST /api/inventory (403)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request(
    "/api/inventory",
    jsonPost(cookie, { product_id: 1, warehouse_id: 1, quantity: 5 }),
  );
  assert.equal(response.status, 403);
});

test("buyer cannot GET /api/warehouses (403)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/warehouses", { headers: { Cookie: cookie } });
  assert.equal(response.status, 403);
});

// ---------------------------------------------------------------------------
// POST /api/inventory -- create, contract shape, ownership, validation.
// ---------------------------------------------------------------------------
test("wholesaler creates stock in an owned warehouse (201, contract shape)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2
  const pool = await openPool();
  let itemId;
  try {
    const warehouseId = await getWarehouseIdByName(pool, "Cebu Fresh Main Warehouse");
    const productId = await getProductIdForBusiness(pool, 2);
    const response = await request(
      "/api/inventory",
      jsonPost(cookie, {
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: 100,
        unit: "cases",
        reorder_threshold: 15,
      }),
    );
    assert.equal(response.status, 201);
    itemId = response.body.item_id;
    assert.ok(Number.isInteger(itemId));
    assert.equal(response.body.product_id, productId);
    assert.equal(response.body.warehouse_id, warehouseId);
    assert.equal(response.body.quantity, 100);
    assert.equal(response.body.unit, "cases");
    assert.equal(response.body.reorder_threshold, 15);
    assert.ok(response.body.created_at);

    // Duplicate (product_id, warehouse_id) violates the UNIQUE pair -> 400.
    const duplicate = await request(
      "/api/inventory",
      jsonPost(cookie, {
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: 1,
      }),
    );
    assert.equal(duplicate.status, 400);
  } finally {
    if (itemId) await deleteItem(pool, itemId);
    await pool.end();
  }
});

test("POST defaults unit and reorder_threshold when omitted", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler2@linko.test"); // business 7
  const pool = await openPool();
  let itemId;
  try {
    const warehouseId = await getWarehouseIdByName(pool, "Mandaue Agri Cold Storage");
    const productId = await getProductIdForBusiness(pool, 7);
    const response = await request(
      "/api/inventory",
      jsonPost(cookie, { product_id: productId, warehouse_id: warehouseId, quantity: 0 }),
    );
    assert.equal(response.status, 201);
    itemId = response.body.item_id;
    assert.equal(response.body.unit, "pcs");
    assert.equal(response.body.reorder_threshold, 10);
  } finally {
    if (itemId) await deleteItem(pool, itemId);
    await pool.end();
  }
});

test("POST to a foreign warehouse is 404, not 403", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2
  const pool = await openPool();
  try {
    const foreignWarehouseId = await getWarehouseIdByName(pool, "Mandaue Agri Cold Storage"); // business 7
    const productId = await getProductIdForBusiness(pool, 2);
    const response = await request(
      "/api/inventory",
      jsonPost(cookie, { product_id: productId, warehouse_id: foreignWarehouseId, quantity: 5 }),
    );
    assert.equal(response.status, 404);
  } finally {
    await pool.end();
  }
});

test("POST validation rejects bad quantity / missing fields", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const pool = await openPool();
  try {
    const warehouseId = await getWarehouseIdByName(pool, "Cebu Fresh Main Warehouse");
    const productId = await getProductIdForBusiness(pool, 2);

    const negative = await request(
      "/api/inventory",
      jsonPost(cookie, { product_id: productId, warehouse_id: warehouseId, quantity: -5 }),
    );
    assert.equal(negative.status, 400);

    const missingProduct = await request(
      "/api/inventory",
      jsonPost(cookie, { warehouse_id: warehouseId, quantity: 5 }),
    );
    assert.equal(missingProduct.status, 400);

    const missingWarehouse = await request(
      "/api/inventory",
      jsonPost(cookie, { product_id: productId, quantity: 5 }),
    );
    assert.equal(missingWarehouse.status, 404);
  } finally {
    await pool.end();
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/inventory/:id -- update, ownership, validation.
// ---------------------------------------------------------------------------
test("wholesaler adjusts their own stock (200, contract shape)", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2
  const pool = await openPool();
  let itemId;
  try {
    const warehouseId = await getWarehouseIdByName(pool, "Cebu Fresh Main Warehouse");
    const productId = await getProductIdForBusiness(pool, 2);
    const created = await request(
      "/api/inventory",
      jsonPost(cookie, { product_id: productId, warehouse_id: warehouseId, quantity: 50 }),
    );
    assert.equal(created.status, 201);
    itemId = created.body.item_id;

    const response = await request(
      `/api/inventory/${itemId}`,
      jsonPatch(cookie, { quantity: 120, reorder_threshold: 25 }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.item_id, itemId);
    assert.equal(response.body.quantity, 120);
    assert.equal(response.body.reorder_threshold, 25);
    assert.equal(response.body.unit, "pcs");

    // The schema trigger logs the quantity change as an adjustment row.
    const { rows } = await pool.query(
      "SELECT transaction_type, quantity_change FROM inventory_transactions WHERE item_id = $1",
      [itemId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].transaction_type, "adjustment");
    assert.equal(rows[0].quantity_change, 70);

    const empty = await request(`/api/inventory/${itemId}`, jsonPatch(cookie, {}));
    assert.equal(empty.status, 400);

    const badUnit = await request(`/api/inventory/${itemId}`, jsonPatch(cookie, { unit: "" }));
    assert.equal(badUnit.status, 400);
  } finally {
    if (itemId) await deleteItem(pool, itemId);
    await pool.end();
  }
});

test("PATCH on a foreign item is 404, not 403", { skip: !hasDb }, async () => {
  const ownerCookie = await loginAs("wholesaler2@linko.test"); // business 7
  const intruderCookie = await loginAs("wholesaler@linko.test"); // business 2
  const pool = await openPool();
  let itemId;
  try {
    const warehouseId = await getWarehouseIdByName(pool, "Mandaue Agri Cold Storage");
    const productId = await getProductIdForBusiness(pool, 7);
    const created = await request(
      "/api/inventory",
      jsonPost(ownerCookie, { product_id: productId, warehouse_id: warehouseId, quantity: 10 }),
    );
    assert.equal(created.status, 201);
    itemId = created.body.item_id;

    const response = await request(
      `/api/inventory/${itemId}`,
      jsonPatch(intruderCookie, { quantity: 0 }),
    );
    assert.equal(response.status, 404);
  } finally {
    if (itemId) await deleteItem(pool, itemId);
    await pool.end();
  }
});

test("PATCH on a missing or malformed id is 404", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const missing = await request("/api/inventory/999999", jsonPatch(cookie, { quantity: 1 }));
  assert.equal(missing.status, 404);
  const malformed = await request("/api/inventory/abc", jsonPatch(cookie, { quantity: 1 }));
  assert.equal(malformed.status, 404);
});

// ---------------------------------------------------------------------------
// GET /api/warehouses -- scoping.
// ---------------------------------------------------------------------------
test("wholesaler sees only their own warehouses", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test"); // business 2, one warehouse
  const response = await request("/api/warehouses", { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  const [warehouse] = response.body;
  assert.equal(warehouse.warehouse_name, "Cebu Fresh Main Warehouse");
  assert.ok(Number.isInteger(warehouse.warehouse_id));
  assert.ok(typeof warehouse.city === "string" && warehouse.city.length > 0);
});

test("platform admin sees all warehouses", { skip: !hasDb }, async () => {
  const cookie = await loginAs("admin@linko.test");
  const response = await request("/api/warehouses", { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.ok(response.body.length >= 3);
});
