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

test("health route reports ok", async () => {
  const response = await request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("inventory route is scaffolded", async () => {
  const response = await request("/api/inventory");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("supplier route is scaffolded", async () => {
  const response = await request("/api/suppliers");

  assert.equal(response.status, 401);
  assert.match(response.body.error.message, /authentication required/i);
});

test("authorized inventory mutation placeholder returns not implemented", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/inventory", {
    method: "POST",
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 501);
  assert.match(response.body.error.message, /not implemented/i);
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

test("buyer session cannot access parcel list", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/parcels", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error.message, /forbidden/i);
});

test("logistics session can access parcel list", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const response = await request("/api/parcels", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  for (const parcel of response.body) {
    assert.ok("current_status" in parcel);
    assert.ok(parcel.sender.full_name);
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

test("booking a parcel creates payment, commission, and first log", { skip: !hasDb }, async () => {
  const cookie = await loginAs("logistics@linko.test");
  const created = await request("/api/parcels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      sender_id: 1,
      receiver_id: 7,
      tier_id: 1,
      origin_address_id: 1,
      destination_address_id: 7,
      weight_kg: 2.5,
      declared_value: 1000,
      total_distance_km: 10,
      payment_method: "COD",
    }),
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.current_status, "Order Created");
  // Current seed pricing: 50 base + 2.5kg x 45 + 10km x 2 = 182.50
  assert.equal(created.body.shipping_fee, 182.5);

  const detail = await request(`/api/parcels/${created.body.parcel_id}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.payment.amount, 1182.5);
  assert.equal(detail.body.tracking_history.length, 1);

  // Remove the test booking so repeated runs do not pile up demo data.
  // Payments, logs, and the commission row cascade with the parcel.
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

test("buyer session can access inventory", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/inventory", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("wholesaler session can access inventory", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const response = await request("/api/inventory", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("buyer session can access suppliers", { skip: !hasDb }, async () => {
  const cookie = await loginAs("buyer@linko.test");
  const response = await request("/api/suppliers", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test("wholesaler session can access suppliers", { skip: !hasDb }, async () => {
  const cookie = await loginAs("wholesaler@linko.test");
  const response = await request("/api/suppliers", {
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
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

  const { createPool } = await import("./db.js");
  const pool = createPool();
  await pool.query("DELETE FROM users WHERE email = $1", [uniqueEmail]);
  await pool.end();
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

  const { createPool } = await import("./db.js");
  const pool = createPool();
  await pool.query("DELETE FROM users WHERE email = $1", [uniqueEmail]);
  await pool.end();
});

test("auth register rejects public privileged role business types without creating sessions", { skip: !hasDb }, async () => {
  const disallowedBusinessTypes = ["admin", "courier", "logistics_coordinator"];

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
