import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { parseParcelListQuery } from "./routes/logistics.js";

const hasDb = Boolean(process.env.DATABASE_URL);

async function request(path, options) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const text = await response.text();
  await new Promise((resolve) => server.close(resolve));
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function coordinatorCookie() {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "logistics@linko.test", password: "Password123!" }),
  });
  assert.equal(response.status, 200);
  return response.cookie;
}

async function buyerCookie() {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "buyer@linko.test", password: "Password123!" }),
  });
  assert.equal(response.status, 200);
  return response.cookie;
}

test("parcel pagination accepts validated logistics filters", () => {
  assert.deepEqual(
    parseParcelListQuery({
      page: "2",
      limit: "25",
      q: "  LKO-001  ",
      status: "Out for Delivery",
      assignment: "active",
    }),
    {
      page: 2,
      limit: 25,
      offset: 25,
      q: "LKO-001",
      status: "Out for Delivery",
      assignment: "active",
    },
  );
});

test("parcel pagination rejects invalid or repeated logistics filters", () => {
  for (const query of [
    { status: "In Transit" },
    { assignment: "queued" },
    { status: ["Picked Up", "Delivered"] },
    { assignment: ["active", "completed"] },
  ]) {
    assert.throws(() => parseParcelListQuery(query), { statusCode: 400 });
  }
});

test("logistics list endpoints paginate and expose complete active options", { skip: !hasDb }, async () => {
  const cookie = await coordinatorCookie();
  const headers = { Cookie: cookie };

  const parcels = await request("/api/parcels?limit=10&assignment=available", { headers });
  assert.equal(parcels.status, 200);
  assert.ok(Array.isArray(parcels.body.items));
  assert.equal(parcels.body.pagination.limit, 10);
  assert.equal(typeof parcels.body.facets.assignment_counts.available, "number");

  const branches = await request("/api/branches?q=cebu", { headers });
  assert.equal(branches.status, 200);
  assert.ok(Array.isArray(branches.body.items));
  assert.equal(typeof branches.body.pagination.total_items, "number");

  const couriers = await request("/api/couriers?limit=25", { headers });
  assert.equal(couriers.status, 200);
  assert.ok(Array.isArray(couriers.body.items));

  const [branchOptions, courierOptions, invalid] = await Promise.all([
    request("/api/branches/options", { headers }),
    request("/api/couriers/options", { headers }),
    request("/api/parcels?assignment=unknown", { headers }),
  ]);
  assert.equal(branchOptions.status, 200);
  assert.ok(Array.isArray(branchOptions.body));
  assert.equal(courierOptions.status, 200);
  assert.ok(Array.isArray(courierOptions.body));
  assert.equal(invalid.status, 400);
});

test("buyer parcel collection scope returns an empty paginated envelope", { skip: !hasDb }, async () => {
  const response = await request("/api/parcels?limit=25", {
    headers: { Cookie: await buyerCookie() },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, []);
  assert.deepEqual(response.body.pagination, {
    page: 1,
    limit: 25,
    total_items: 0,
    total_pages: 0,
  });
  assert.deepEqual(response.body.facets.assignment_counts, {
    available: 0,
    active: 0,
    completed: 0,
  });
});
