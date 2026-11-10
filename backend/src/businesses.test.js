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
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function post(path, body, cookie) {
  return request(path, { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}

async function login(email) {
  const result = await post("/api/auth/login", { email, password: "Password123!" });
  assert.equal(result.status, 200);
  return result.cookie;
}

test("buyer adds businesses without a cap and switches business context without logout", { skip: !hasDb }, async () => {
  const pool = createPool();
  const email = `add-business-${Date.now()}@linko.test`;
  let userId;
  try {
    const registered = await post("/api/auth/register", {
      email, password: "Password123!", full_name: "Business Owner", business_name: "First Buyer", business_type: "buyer",
    });
    assert.equal(registered.status, 201);
    userId = registered.body.user.user_id;
    const buyer = registered.body.memberships[0];
    const cookie = registered.cookie;
    const added = await post("/api/businesses", { business_name: "  New Wholesaler  ", business_type: "wholesaler", user_id: 1 }, cookie);
    assert.equal(added.status, 201);
    assert.deepEqual(added.body, { business_id: added.body.business_id, business_name: "New Wholesaler", business_type: "wholesaler", role: "wholesaler", has_coordinates: false });
    const { rows } = await pool.query(`SELECT b.business_type, bm.role, a.address_id, a.latitude, a.longitude, a.is_default
      FROM businesses b JOIN user_businesses ub USING (business_id)
      JOIN business_memberships bm ON bm.business_id = b.business_id AND bm.user_id = ub.user_id
      JOIN addresses a ON a.address_id = b.logistics_address_id AND a.business_id = b.business_id
      WHERE b.business_id = $1 AND ub.user_id = $2`, [added.body.business_id, userId]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].business_type, "wholesaler");
    assert.equal(rows[0].role, "wholesaler");
    assert.ok(rows[0].address_id);
    assert.equal(rows[0].latitude, null);
    assert.equal(rows[0].longitude, null);
    assert.equal(rows[0].is_default, true);
    const me = await request("/api/auth/me", { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body.memberships, [buyer, added.body]);
    for (const [businessId, status] of [[added.body.business_id, 200], [buyer.business_id, 403], [added.body.business_id, 200]]) {
      const dashboard = await request("/api/dashboard", { headers: { Cookie: cookie, "X-Active-Business": String(businessId) } });
      assert.equal(dashboard.status, status);
    }
    const buyerOrders = await request("/api/orders", { headers: { Cookie: cookie, "X-Active-Business": String(buyer.business_id) } });
    assert.equal(buyerOrders.status, 200);
    assert.deepEqual(buyerOrders.body.items, []);
    assert.equal((await request("/api/dashboard", { headers: { Cookie: cookie } })).status, 400);
    const third = await post("/api/businesses", { business_name: "Second Wholesaler", business_type: "wholesaler" }, cookie);
    assert.equal(third.status, 201);
    assert.equal(third.body.role, "wholesaler");
    assert.equal((await request("/api/auth/me", { headers: { Cookie: cookie } })).body.memberships.length, 3);
  } finally {
    if (userId) {
      const { rows } = await pool.query("SELECT business_id FROM user_businesses WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM addresses WHERE business_id = ANY($1::int[])", [rows.map((row) => row.business_id)]);
      await pool.query("DELETE FROM businesses WHERE business_id = ANY($1::int[])", [rows.map((row) => row.business_id)]);
    }
    await pool.end();
  }
});

test("adding a business requires authentication and rejects platform admins", { skip: !hasDb }, async () => {
  const body = { business_name: "Forbidden", business_type: "buyer" };
  assert.equal((await post("/api/businesses", body)).status, 401);
  assert.equal((await post("/api/businesses", body, await login("admin@linko.test"))).status, 403);
});

test("add business validates required names and buyer/wholesaler types", { skip: !hasDb }, async () => {
  const cookie = await login("buyer@linko.test");
  for (const invalid of [undefined, null, "", "   ", 123, {}, []]) {
    assert.equal((await post("/api/businesses", { business_name: invalid, business_type: "buyer" }, cookie)).status, 400);
    assert.equal((await post("/api/businesses", { business_name: "Invalid", business_type: invalid }, cookie)).status, 400);
  }
  for (const business_type of ["both", "platform_admin", "courier", "logistics_coordinator"]) {
    assert.equal((await post("/api/businesses", { business_name: "Invalid", business_type }, cookie)).status, 400);
  }
});
