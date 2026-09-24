import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Saved address book: one default per business, and that default is the
// canonical logistics pin. DB-backed tests skip without DATABASE_URL.
const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, { method = "GET", cookie, business, body } = {}) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(business !== undefined ? { "X-Active-Business": String(business) } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  await new Promise((resolve) => server.close(resolve));
  return { body: parsed, status: response.status, setCookie };
}

async function withPool(fn) {
  const pool = createPool();
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function registerBusiness(businessType) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const response = await request("/api/auth/register", {
    method: "POST",
    body: {
      email: `addr-${stamp}@linko.test`,
      password: "Password123!",
      full_name: "Address Test",
      business_name: `Addr ${businessType} ${stamp}`,
      business_type: businessType,
    },
  });
  assert.equal(response.status, 201);
  return {
    cookie: response.setCookie.split(";")[0],
    businessId: response.body.memberships[0].business_id,
  };
}

const SECOND = {
  label: "Warehouse B",
  province: "Cebu",
  city_municipality: "Mandaue City",
  barangay: "Tipolo",
  street_address: "32 Plaridel St",
  postal_code: "6014",
  latitude: 10.332,
  longitude: 123.9351,
};

test("address book requires an active buyer or wholesaler", { skip: !hasDb }, async () => {
  const unauthenticated = await request("/api/settings/addresses");
  assert.equal(unauthenticated.status, 401);

  const buyer = await registerBusiness("buyer");
  const listed = await request("/api/settings/addresses", { cookie: buyer.cookie });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.business_id, buyer.businessId);
  assert.equal(listed.body.address_book_kind, "delivery");
  assert.equal(listed.body.addresses.length, 1);
  assert.equal(listed.body.addresses[0].is_default, true);
  assert.equal(listed.body.addresses[0].label, "Primary");
  assert.equal(listed.body.addresses[0].has_coordinates, false);

  const wholesaler = await registerBusiness("wholesaler");
  const wholesaleBook = await request("/api/settings/addresses", { cookie: wholesaler.cookie });
  assert.equal(wholesaleBook.body.address_book_kind, "pickup");
});

test("create, set default, and delete follow the single-default rules", { skip: !hasDb }, async () => {
  const { cookie, businessId } = await registerBusiness("buyer");
  const before = await request("/api/settings/addresses", { cookie });
  const placeholderId = before.body.addresses[0].address_id;

  const created = await request("/api/settings/addresses", {
    method: "POST",
    cookie,
    body: SECOND,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_default, false);
  assert.equal(created.body.latitude, 10.332);
  assert.equal(created.body.has_coordinates, true);
  const extraId = created.body.address_id;

  const listed = await request("/api/settings/addresses", { cookie });
  assert.equal(listed.body.addresses.length, 2);
  assert.equal(listed.body.addresses[0].address_id, placeholderId);
  assert.equal(listed.body.addresses[0].is_default, true);

  await withPool(async (pool) => {
    const { rows } = await pool.query(
      "SELECT logistics_address_id FROM businesses WHERE business_id = $1",
      [businessId],
    );
    assert.equal(rows[0].logistics_address_id, placeholderId, "pin stays on the original default");
  });

  const blockedDefault = await request(`/api/settings/addresses/${placeholderId}`, {
    method: "DELETE",
    cookie,
  });
  assert.equal(blockedDefault.status, 409);
  assert.match(blockedDefault.body.error.message, /default/);

  const promoted = await request(`/api/settings/addresses/${extraId}/default`, {
    method: "POST",
    cookie,
  });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.body.is_default, true);
  assert.equal(promoted.body.address_id, extraId);

  await withPool(async (pool) => {
    const pin = await pool.query(
      "SELECT logistics_address_id FROM businesses WHERE business_id = $1",
      [businessId],
    );
    assert.equal(pin.rows[0].logistics_address_id, extraId, "setting the default moves the pin");
    const defaults = await pool.query(
      "SELECT COUNT(*)::int AS count FROM addresses WHERE business_id = $1 AND is_default",
      [businessId],
    );
    assert.equal(defaults.rows[0].count, 1);
  });

  const blockedLastStyle = await request(`/api/settings/addresses/${extraId}`, {
    method: "DELETE",
    cookie,
  });
  assert.equal(blockedLastStyle.status, 409);
  assert.match(blockedLastStyle.body.error.message, /default/);

  const removed = await request(`/api/settings/addresses/${placeholderId}`, {
    method: "DELETE",
    cookie,
  });
  assert.equal(removed.status, 204);

  const after = await request("/api/settings/addresses", { cookie });
  assert.equal(after.body.addresses.length, 1);
  assert.equal(after.body.addresses[0].address_id, extraId);
  assert.equal(after.body.addresses[0].is_default, true);

  const last = await request(`/api/settings/addresses/${extraId}`, { method: "DELETE", cookie });
  assert.equal(last.status, 409);
  assert.match(last.body.error.message, /last one/);
});

test("addresses stay inside the active business and reject bad coordinates", { skip: !hasDb }, async () => {
  const owner = await registerBusiness("wholesaler");
  const other = await registerBusiness("buyer");
  const created = await request("/api/settings/addresses", {
    method: "POST",
    cookie: owner.cookie,
    body: { ...SECOND, label: "Dock" },
  });
  assert.equal(created.status, 201);

  const foreignList = await request("/api/settings/addresses", { cookie: other.cookie });
  assert.equal(foreignList.body.addresses.some((row) => row.address_id === created.body.address_id), false);

  const foreignEdit = await request(`/api/settings/addresses/${created.body.address_id}`, {
    method: "PUT",
    cookie: other.cookie,
    body: { ...SECOND, label: "Stolen" },
  });
  assert.equal(foreignEdit.status, 404);

  const foreignDefault = await request(`/api/settings/addresses/${created.body.address_id}/default`, {
    method: "POST",
    cookie: other.cookie,
  });
  assert.equal(foreignDefault.status, 404);

  const foreignDelete = await request(`/api/settings/addresses/${created.body.address_id}`, {
    method: "DELETE",
    cookie: other.cookie,
  });
  assert.equal(foreignDelete.status, 404);

  const blank = await request("/api/settings/addresses", {
    method: "POST",
    cookie: owner.cookie,
    body: { ...SECOND, label: "  " },
  });
  assert.equal(blank.status, 400);
  assert.match(blank.body.error.message, /label/);

  const nullIsland = await request("/api/settings/addresses", {
    method: "POST",
    cookie: owner.cookie,
    body: { ...SECOND, latitude: 0, longitude: 0 },
  });
  assert.equal(nullIsland.status, 400);

  const edited = await request(`/api/settings/addresses/${created.body.address_id}`, {
    method: "PUT",
    cookie: owner.cookie,
    body: { ...SECOND, label: "Dock renamed", street_address: "9 Pier Rd" },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.label, "Dock renamed");
  assert.equal(edited.body.street_address, "9 Pier Rd");
  assert.equal(edited.body.is_default, false, "editing does not steal the default");
});
