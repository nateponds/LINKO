import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 13 T10: business location settings — active-business scoping,
// create-or-update with placeholder repair, shared coordinate validation,
// and the has_coordinates membership flag.
// DB-backed tests skip without DATABASE_URL, same as app.test.js.
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

async function loginAs(email, password = "Password123!") {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(response.status, 200);
  return response.setCookie.split(";")[0];
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
      email: `t10-${stamp}@linko.test`,
      password: "Password123!",
      full_name: "T10 Test",
      business_name: `T10 ${businessType} ${stamp}`,
      business_type: businessType,
    },
  });
  assert.equal(response.status, 201);
  return {
    cookie: response.setCookie.split(";")[0],
    membership: response.body.memberships[0],
    businessId: response.body.memberships[0].business_id,
  };
}

const VALID_BODY = {
  province: "Cebu",
  city_municipality: "Cebu City",
  barangay: "Banilad",
  street_address: "88 Gov. Cuenco Ave",
  postal_code: "6000",
  latitude: 10.3444,
  longitude: 123.9137,
};

test("location settings are scoped to an active buyer/wholesaler business", { skip: !hasDb }, async () => {
  const unauthenticated = await request("/api/settings/location");
  assert.equal(unauthenticated.status, 401);

  // logistics-only membership: no buyer/wholesaler role anywhere
  const coordinator = await loginAs("logistics@linko.test");
  const coordinatorGet = await request("/api/settings/location", { cookie: coordinator });
  assert.equal(coordinatorGet.status, 403);
  assert.equal(coordinatorGet.body.error.message, "You must belong to a buyer or wholesaler business");

  // coordinator selecting their own business explicitly: member, wrong role
  const coordinatorHeader = await request("/api/settings/location", { cookie: coordinator, business: 3 });
  assert.equal(coordinatorHeader.status, 403);

  // platform admin has no global bypass — no marketplace membership, no access
  const admin = await loginAs("admin@linko.test");
  const adminGet = await request("/api/settings/location", { cookie: admin });
  assert.equal(adminGet.status, 403);

  // multi-business caller must name the business
  const bizswitch = await loginAs("bizswitch@linko.test");
  const noHeader = await request("/api/settings/location", { cookie: bizswitch });
  assert.equal(noHeader.status, 400);
  assert.match(noHeader.body.error.message, /X-Active-Business/);

  const foreign = await request("/api/settings/location", { cookie: bizswitch, business: 1 });
  assert.equal(foreign.status, 403);
  assert.equal(foreign.body.error.message, "Not a member of the selected business");

  const scoped = await request("/api/settings/location", { cookie: bizswitch, business: 8 });
  assert.equal(scoped.status, 200);
  assert.equal(scoped.body.business_id, 8);
  assert.equal(scoped.body.business_type, "buyer");
});

test("GET returns the registration placeholder and PUT repairs it in place", { skip: !hasDb }, async () => {
  const { cookie, businessId } = await registerBusiness("wholesaler");

  const before = await request("/api/settings/location", { cookie });
  assert.equal(before.status, 200);
  assert.equal(before.body.business_type, "wholesaler");
  assert.equal(before.body.province, "Not provided");
  assert.equal(before.body.has_coordinates, false);
  assert.equal(before.body.latitude, null);
  const placeholderId = before.body.address_id;
  assert.ok(placeholderId, "registration created a placeholder pointer");

  // numeric strings must normalize to JSON numbers
  const saved = await request("/api/settings/location", {
    method: "PUT",
    cookie,
    body: { ...VALID_BODY, latitude: "10.3444", longitude: "123.9137" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.address_id, placeholderId, "placeholder repaired, not replaced");
  assert.equal(saved.body.latitude, 10.3444);
  assert.equal(saved.body.longitude, 123.9137);
  assert.equal(saved.body.has_coordinates, true);
  assert.equal(saved.body.province, "Cebu");

  const after = await request("/api/settings/location", { cookie });
  assert.equal(after.body.street_address, "88 Gov. Cuenco Ave");
  assert.equal(after.body.has_coordinates, true);

  await withPool(async (pool) => {
    const { rows } = await pool.query(
      "SELECT logistics_address_id FROM businesses WHERE business_id = $1",
      [businessId],
    );
    assert.equal(rows[0].logistics_address_id, placeholderId, "pointer unchanged");
  });
});

test("PUT creates the address and sets the pointer when it is missing", { skip: !hasDb }, async () => {
  const { cookie, businessId } = await registerBusiness("buyer");
  await withPool((pool) =>
    pool.query("UPDATE businesses SET logistics_address_id = NULL WHERE business_id = $1", [businessId]),
  );

  const empty = await request("/api/settings/location", { cookie });
  assert.equal(empty.status, 200);
  assert.equal(empty.body.address_id, null);
  assert.equal(empty.body.province, null);
  assert.equal(empty.body.has_coordinates, false);

  const saved = await request("/api/settings/location", { method: "PUT", cookie, body: VALID_BODY });
  assert.equal(saved.status, 200);
  assert.ok(saved.body.address_id, "a new address row was created");
  assert.equal(saved.body.has_coordinates, true);

  await withPool(async (pool) => {
    const { rows } = await pool.query(
      `SELECT b.logistics_address_id, a.business_id AS address_owner
         FROM businesses b
         JOIN addresses a ON a.address_id = b.logistics_address_id
        WHERE b.business_id = $1`,
      [businessId],
    );
    assert.equal(rows[0].logistics_address_id, saved.body.address_id, "pointer set to the new row");
    assert.equal(rows[0].address_owner, businessId, "created address belongs to the business");
  });
});

test("validation rejects bad text and coordinate input, persisting nothing", { skip: !hasDb }, async () => {
  const { cookie } = await registerBusiness("buyer");
  const put = (body) => request("/api/settings/location", { method: "PUT", cookie, body });

  const blankText = await put({ ...VALID_BODY, province: "  " });
  assert.equal(blankText.status, 400);
  assert.match(blankText.body.error.message, /province/);

  const oneSided = await put({ ...VALID_BODY, longitude: null });
  assert.equal(oneSided.status, 400);
  assert.match(oneSided.body.error.message, /together/);

  const nullIsland = await put({ ...VALID_BODY, latitude: 0, longitude: 0 });
  assert.equal(nullIsland.status, 400);

  const outOfRange = await put({ ...VALID_BODY, latitude: 91 });
  assert.equal(outOfRange.status, 400);

  // empty strings are not coordinates — they must not coerce to 0
  const emptyStrings = await put({ ...VALID_BODY, latitude: "", longitude: "" });
  assert.equal(emptyStrings.status, 400);
  assert.match(emptyStrings.body.error.message, /finite/);

  const untouched = await request("/api/settings/location", { cookie });
  assert.equal(untouched.body.province, "Not provided", "failed PUTs persisted nothing");
  assert.equal(untouched.body.has_coordinates, false);
});

test("saving coordinates flips membership has_coordinates and unpin flips it back", { skip: !hasDb }, async () => {
  const { cookie, membership } = await registerBusiness("buyer");

  // register payload already carries the new membership fields
  assert.equal(membership.business_type, "buyer");
  assert.equal(membership.has_coordinates, false);

  const meBefore = await request("/api/auth/me", { cookie });
  assert.equal(meBefore.body.memberships[0].has_coordinates, false);
  assert.equal(meBefore.body.memberships[0].business_type, "buyer");

  const saved = await request("/api/settings/location", { method: "PUT", cookie, body: VALID_BODY });
  assert.equal(saved.status, 200);

  const meAfter = await request("/api/auth/me", { cookie });
  assert.equal(meAfter.body.memberships[0].has_coordinates, true, "flag flips false -> true after save");

  // explicit null pair unpins: the gates re-engage and the flag drops
  const unpinned = await request("/api/settings/location", {
    method: "PUT",
    cookie,
    body: { ...VALID_BODY, latitude: null, longitude: null },
  });
  assert.equal(unpinned.status, 200);
  assert.equal(unpinned.body.has_coordinates, false);

  const meUnpinned = await request("/api/auth/me", { cookie });
  assert.equal(meUnpinned.body.memberships[0].has_coordinates, false);
});
