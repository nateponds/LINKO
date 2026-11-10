import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

async function request(path, cookie, method = "GET", body) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.text().then((s) => s ? JSON.parse(s) : null), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}
async function login(email) {
  const r = await request("/api/auth/login", null, "POST", { email, password: "Password123!" });
  assert.equal(r.status, 200);
  return r.cookie;
}

test("takedown, owner visibility, editing, relisting and final deletion", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = createPool();
  const ids = [];
  const stamp = `a2-${Date.now()}`;
  try {
    const owner = await login("wholesaler@linko.test");
    const other = await login("wholesaler2@linko.test");
    const buyer = await login("buyer@linko.test");
    const admin = await login("admin@linko.test");
    const adminId = (await pool.query("SELECT user_id FROM users WHERE email = 'admin@linko.test'")).rows[0].user_id;
    async function create(sku) {
      const r = await request("/api/products", owner, "POST", { product_name: stamp, sku, unit_price: 10 });
      assert.equal(r.status, 201); ids.push(r.body.product_id); return r.body.product_id;
    }
    const id = await create(stamp);
    const path = `/api/products/${id}`;
    const take = `/api/admin/products/${id}/takedown`;
    for (const reason of [undefined, "", "   ", 5]) assert.equal((await request(take, admin, "POST", { reason })).status, 400);
    assert.equal((await request(take, owner, "POST", { reason: stamp })).status, 403);
    assert.equal((await request(path, admin, "DELETE")).status, 403);
    assert.equal((await request(take, admin, "POST", { reason: stamp })).status, 200);
    const removed = (await pool.query("SELECT * FROM products WHERE product_id = $1", [id])).rows[0];
    assert.equal(removed.is_active, false); assert.equal(removed.removed_by, adminId);
    assert.equal(removed.removal_reason, stamp); assert.ok(removed.removed_at);
    const notifications = (await pool.query("SELECT * FROM notifications WHERE message LIKE $1", [`%${stamp}%`])).rows;
    assert.ok(notifications.length); assert.ok(notifications.every((n) => n.type === "warning"));
    assert.equal((await request(take, admin, "POST", { reason: "Repeated takedown" })).status, 404);
    assert.deepEqual((await pool.query("SELECT * FROM products WHERE product_id = $1", [id])).rows[0], removed);
    assert.deepEqual((await pool.query("SELECT * FROM notifications WHERE message LIKE $1", [`%${stamp}%`])).rows, notifications);
    assert.equal((await request(path, owner)).status, 200);
    assert.equal((await request(path, other)).status, 404);
    assert.equal((await request(path, buyer)).status, 404);
    assert.equal((await request(path, other, "PATCH", { product_name: "no" })).status, 403);
    assert.equal((await request(path, owner, "PATCH", { description: "edited while removed" })).body.description, "edited while removed");
    const list = `/api/products?q=${stamp}`;
    assert.equal((await request(list, owner)).body.items.length, 1);
    assert.equal((await request(list, other)).body.items.length, 0);
    assert.equal((await request(list, admin)).body.items.length, 0);
    assert.equal((await request(list, buyer)).body.items.length, 0);
    assert.equal((await request(list)).status, 401);
    assert.equal((await request(`${list}&business_id=${removed.business_id}`, owner)).body.items.length, 1);
    assert.equal((await request(`${list}&business_id=${removed.business_id}`, other)).body.items.length, 0);
    assert.equal((await request(`${path}/relist`, other, "POST")).status, 403);
    const clash = await create(stamp);
    assert.equal((await request(`${path}/relist`, owner, "POST")).status, 409);
    assert.equal((await request(`/api/products/${clash}`, owner, "DELETE")).status, 204);
    const deleted = (await pool.query("SELECT * FROM products WHERE product_id = $1", [clash])).rows[0];
    assert.equal((await request(`/api/admin/products/${clash}/takedown`, admin, "POST", { reason: stamp })).status, 404);
    assert.deepEqual((await pool.query("SELECT * FROM products WHERE product_id = $1", [clash])).rows[0], deleted);
    assert.equal(deleted.removed_at, null);
    assert.deepEqual((await pool.query("SELECT * FROM notifications WHERE message LIKE $1", [`%${stamp}%`])).rows, notifications);
    assert.equal((await request(`/api/products/${clash}/relist`, owner, "POST")).status, 404);
    const relisted = await request(`${path}/relist`, owner, "POST");
    assert.equal(relisted.status, 200); assert.equal(relisted.body.is_active, true);
    assert.equal(relisted.body.removed_at, null); assert.equal(relisted.body.removed_by, adminId);
    assert.equal(relisted.body.removal_reason, stamp);
    assert.equal((await request(path, owner, "DELETE")).status, 204);
    assert.equal((await request(`${path}/relist`, owner, "POST")).status, 404);
    assert.equal((await request(path, owner)).status, 404);
    const takenDeleted = await create(`${stamp}-delete`);
    assert.equal((await request(`/api/admin/products/${takenDeleted}/takedown`, admin, "POST", { reason: stamp })).status, 200);
    assert.equal((await request(`/api/products/${takenDeleted}`, owner, "DELETE")).status, 204);
    assert.equal((await request(`/api/products/${takenDeleted}/relist`, owner, "POST")).status, 404);
  } finally {
    await pool.query("DELETE FROM notifications WHERE message LIKE $1", [`%${stamp}%`]);
    await pool.query("DELETE FROM products WHERE product_id = ANY($1::int[])", [ids]);
    await pool.end();
  }
});

test("registration and admin provisioning leave users.role NULL", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = createPool();
  const emails = [`a2-register-${Date.now()}@linko.test`, `a2-admin-${Date.now()}@linko.test`];
  const businessIds = [];
  try {
    const registered = await request("/api/auth/register", null, "POST", {
      email: emails[0], password: "Password123!", full_name: "A2", business_name: "A2", business_type: "buyer",
    });
    assert.equal(registered.status, 201); businessIds.push(registered.body.memberships[0].business_id);
    const admin = await login("admin@linko.test");
    const provisioned = await request("/api/admin/users", admin, "POST", {
      email: emails[1], password: "Password123!", full_name: "A2 Admin", kind: "platform_admin",
    });
    assert.equal(provisioned.status, 201);
    const rows = (await pool.query("SELECT role FROM users WHERE email = ANY($1::text[])", [emails])).rows;
    assert.equal(rows.length, 2); assert.ok(rows.every((r) => r.role === null));
  } finally {
    await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [emails]);
    await pool.query("DELETE FROM businesses WHERE business_id = ANY($1::int[])", [businessIds]);
    await pool.end();
  }
});

test("booking, courier scan and admin force-status record the acting user", { skip: !process.env.DATABASE_URL }, async () => {
  const pool = createPool();
  let id;
  try {
    const coordinator = await login("logistics@linko.test");
    const courier = await login("courier@linko.test");
    const admin = await login("admin@linko.test");
    const booked = await request("/api/parcels", coordinator, "POST", {
      sender_id: 2, receiver_id: 1, tier_id: 1, origin_address_id: 3,
      destination_address_id: 1, weight_kg: 1, payment_method: "Prepaid",
    });
    assert.equal(booked.status, 201); id = booked.body.parcel_id;
    assert.equal((await pool.query("SELECT recorded_by FROM tracking_logs WHERE parcel_id = $1", [id])).rows[0].recorded_by, 3);
    const scan = await request(`/api/parcels/${id}/tracking`, courier, "POST", { status_update: "Picked Up" });
    assert.equal(scan.status, 201); assert.equal(scan.body.recorded_by, 4);
    const forced = await request(`/api/parcels/${id}/tracking`, admin, "POST", { status_update: "Cancelled", remarks: "A2 override" });
    assert.equal(forced.status, 201); assert.equal(forced.body.recorded_by, 5);
    assert.equal((await pool.query("SELECT recorded_by FROM tracking_logs WHERE log_id = $1", [forced.body.log_id])).rows[0].recorded_by, 5);
  } finally {
    if (id) await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [id]);
    await pool.end();
  }
});
