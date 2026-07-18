import assert from "node:assert/strict";
import test from "node:test";
import { createPool } from "./db.js";
import { resolveInitialBranchId } from "./services/parcelRouting.js";

// Sprint 13 T04: shared nearest-available-branch resolver.
// DB-backed tests skip without DATABASE_URL, same as app.test.js.
const hasDb = Boolean(process.env.DATABASE_URL);

// Every test runs inside a rolled-back transaction. Seeded branches are
// sidelined first (is_available = false) so only the branches a test creates
// are candidates; the rollback restores everything.
async function withScenario(fn) {
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE branches SET is_available = false");
    await fn(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
}

async function createAddress(client, { city = "Testopolis", latitude = null, longitude = null } = {}) {
  const { rows } = await client.query(
    `INSERT INTO addresses (business_id, province, city_municipality, latitude, longitude)
     VALUES (NULL, 'Test', $1, $2, $3)
     RETURNING address_id`,
    [city, latitude, longitude],
  );
  return rows[0].address_id;
}

let branchSeq = 0;
async function createBranch(client, { latitude = null, longitude = null, city = "Branchville", active = true, available = true } = {}) {
  const addressId = await createAddress(client, { city, latitude, longitude });
  const { rows } = await client.query(
    `INSERT INTO branches (branch_name, address_id, is_active, is_available)
     VALUES ($1, $2, $3, $4)
     RETURNING branch_id`,
    [`T04 Test Branch ${Date.now()}-${branchSeq++}`, addressId, active, available],
  );
  return rows[0].branch_id;
}

test("picks the nearest branch among several pinned candidates", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    await createBranch(client, { latitude: 14.5995, longitude: 120.9842 }); // Manila, ~570km
    const cebu = await createBranch(client, { latitude: 10.32, longitude: 123.92 }); // ~1km
    await createBranch(client, { latitude: 7.07, longitude: 125.61 }); // Davao, ~400km
    const origin = await createAddress(client, { latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, origin), cebu);
  });
});

test("identical origin and branch point resolves (acos clamp, distance 0 wins)", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    await createBranch(client, { latitude: 10.33, longitude: 123.9 }); // ~200m away
    const exact = await createBranch(client, { latitude: 10.3283, longitude: 123.8988 });
    const origin = await createAddress(client, { latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, origin), exact);
  });
});

test("equidistant branches tie-break on lowest branch_id", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    // identical coordinates -> exactly equal distance
    const first = await createBranch(client, { latitude: 10.35, longitude: 123.91 });
    const second = await createBranch(client, { latitude: 10.35, longitude: 123.91 });
    assert.ok(first < second, "serial ids must be ascending");
    const origin = await createAddress(client, { latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, origin), first);
  });
});

test("excludes unavailable, inactive, and unpinned branches from Haversine", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    await createBranch(client, { latitude: 10.3283, longitude: 123.8988, available: false }); // nearest, gated
    await createBranch(client, { latitude: 10.329, longitude: 123.899, active: false }); // retired
    await createBranch(client, { city: "Testopolis" }); // unpinned, city would match but Haversine wins first
    const far = await createBranch(client, { latitude: 14.5995, longitude: 120.9842 }); // Manila, only real candidate
    const origin = await createAddress(client, { city: "Nowhere", latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, origin), far);
  });
});

test("unpinned origin falls back to city match, trimmed and case-insensitive", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const match = await createBranch(client, { city: "  TESTOPOLIS " });
    const origin = await createAddress(client, { city: "testopolis  " });
    assert.equal(await resolveInitialBranchId(client, origin), match);
  });
});

test("city fallback is deterministic: lowest branch_id among same-city branches", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const first = await createBranch(client, { city: "Testopolis" });
    const second = await createBranch(client, { city: "Testopolis" });
    assert.ok(first < second);
    const origin = await createAddress(client, { city: "Testopolis" });
    assert.equal(await resolveInitialBranchId(client, origin), first);
  });
});

test("city fallback excludes unavailable and inactive branches", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    await createBranch(client, { city: "Testopolis", available: false });
    await createBranch(client, { city: "Testopolis", active: false });
    const live = await createBranch(client, { city: "Testopolis" });
    const origin = await createAddress(client, { city: "Testopolis" });
    assert.equal(await resolveInitialBranchId(client, origin), live);
  });
});

test("pinned origin with zero pinned candidates falls back to city", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const unpinnedCityMatch = await createBranch(client, { city: "Testopolis" });
    const origin = await createAddress(client, { city: "Testopolis", latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, origin), unpinnedCityMatch);
  });
});

test("zero candidates of any kind resolves NULL, never throws", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    const pinned = await createAddress(client, { city: "Nowhere", latitude: 10.3283, longitude: 123.8988 });
    assert.equal(await resolveInitialBranchId(client, pinned), null);
    const unpinned = await createAddress(client, { city: "Nowhere" });
    assert.equal(await resolveInitialBranchId(client, unpinned), null);
  });
});

test("missing or absent origin address resolves NULL", { skip: !hasDb }, async () => {
  await withScenario(async (client) => {
    assert.equal(await resolveInitialBranchId(client, 999999999), null);
    assert.equal(await resolveInitialBranchId(client, null), null);
    assert.equal(await resolveInitialBranchId(client, undefined), null);
  });
});
