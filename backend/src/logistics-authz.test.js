import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import createApp from "./app.js";
import { createPool } from "./db.js";

// Sprint 7 correctness follow-up: sequence-backed parcel IDs (migration 016),
// courier branch-scope enforcement, concurrent claim safety, branch-delete
// guard against a live unassigned pool, and deactivated-courier lockout.
// DB-backed, skips without DATABASE_URL, relies on the dev seed accounts
// (backend/seeds/dev_seed.sql; password "Password123!" for every account).
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
  assert.equal(response.status, 200, `login should succeed for ${email}`);
  assert.match(response.setCookie, /linko_session=/);
  return response.setCookie.split(";")[0];
}

async function getBusinessIdByName(pool, name) {
  const { rows } = await pool.query(
    "SELECT business_id FROM businesses WHERE business_name = $1",
    [name],
  );
  assert.ok(rows[0], `expected business ${name} to exist`);
  return rows[0].business_id;
}

async function getAddressIdForBusiness(pool, businessName) {
  const businessId = await getBusinessIdByName(pool, businessName);
  const { rows } = await pool.query(
    "SELECT address_id FROM addresses WHERE business_id = $1 ORDER BY address_id LIMIT 1",
    [businessId],
  );
  assert.ok(rows[0], `expected business ${businessName} to have an address`);
  return rows[0].address_id;
}

// Direct-SQL parcel fixture mirroring migrations 002/007/009/010 required
// columns. Suffixed with process.pid plus a random slice to stay unique
// across parallel/rerun test invocations.
async function createParcel(pool, overrides = {}) {
  const senderId =
    overrides.senderId ?? (await getBusinessIdByName(pool, "Cebu Fresh Wholesale"));
  const receiverId =
    overrides.receiverId ?? (await getBusinessIdByName(pool, "Sunrise Retail Cooperative"));
  const originAddressId =
    overrides.originAddressId ?? (await getAddressIdForBusiness(pool, "Cebu Fresh Wholesale"));
  const destinationAddressId =
    overrides.destinationAddressId ??
    (await getAddressIdForBusiness(pool, "Sunrise Retail Cooperative"));
  const parcelId =
    overrides.parcelId ??
    `TST-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

  await pool.query(
    `INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                          origin_address_id, destination_address_id, weight_kg)
     VALUES ($1, $2, $3, 1, $4, $5, 1.0)`,
    [parcelId, senderId, receiverId, originAddressId, destinationAddressId],
  );
  return parcelId;
}

test("sequential parcel IDs never collide", { skip: !hasDb }, async () => {
  const coordinatorCookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const parcelIds = [];
  try {
    const senderId = await getBusinessIdByName(pool, "Cebu Fresh Wholesale");
    const receiverId = await getBusinessIdByName(pool, "Sunrise Retail Cooperative");
    const originAddressId = await getAddressIdForBusiness(pool, "Cebu Fresh Wholesale");
    const destinationAddressId = await getAddressIdForBusiness(pool, "Sunrise Retail Cooperative");

    for (let i = 0; i < 2; i += 1) {
      const created = await request("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          tier_id: 1,
          origin_address_id: originAddressId,
          destination_address_id: destinationAddressId,
          weight_kg: 2.5,
          payment_method: "Prepaid",
        }),
      });
      assert.equal(created.status, 201, `booking ${i} should succeed`);
      parcelIds.push(created.body.parcel_id);
    }

    for (const id of parcelIds) {
      assert.match(id, /^LKO-\d{8}$/, `parcel id ${id} should match sequence format`);
    }
    assert.notEqual(parcelIds[0], parcelIds[1], "two bookings should never collide");
  } finally {
    for (const id of parcelIds) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [id]);
    }
    await pool.end();
  }
});

test("cross-branch courier scan is rejected as not found", { skip: !hasDb }, async () => {
  // courier@linko.test is assigned to branch 1 (Cebu); put the parcel in
  // branch 2's (Mandaue) unassigned pool so it is out of scope.
  const courierCookie = await loginAs("courier@linko.test");
  const pool = createPool();
  let parcelId;
  try {
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Cross-branch test', 2, NULL)`,
      [parcelId],
    );

    const scan = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: courierCookie },
      body: JSON.stringify({ status_update: "Picked Up" }),
    });
    assert.equal(scan.status, 404, "courier from a different branch should get 404, not 403");
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    await pool.end();
  }
});

test("concurrent claim on the same pool parcel has exactly one winner", { skip: !hasDb }, async () => {
  const pool = createPool();
  let parcelId;
  let restoreCourier2Branch;
  try {
    // courier@ = branch 1, courier2@ = branch 2 by seed. Move courier2 onto
    // branch 1 temporarily so both couriers can legitimately race for the
    // same pool parcel, then restore its original assignment in cleanup.
    const { rows: courier2Rows } = await pool.query(
      "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = (SELECT user_id FROM users WHERE email = 'courier2@linko.test')",
    );
    assert.ok(courier2Rows[0], "expected courier2 seed row to exist");
    const courier2Id = courier2Rows[0].courier_id;
    const originalBranchId = courier2Rows[0].assigned_branch_id;
    await pool.query("UPDATE couriers SET assigned_branch_id = 1 WHERE courier_id = $1", [
      courier2Id,
    ]);
    restoreCourier2Branch = async () => {
      await pool.query("UPDATE couriers SET assigned_branch_id = $1 WHERE courier_id = $2", [
        originalBranchId,
        courier2Id,
      ]);
    };

    const courierCookie = await loginAs("courier@linko.test");
    const courier2Cookie = await loginAs("courier2@linko.test");

    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Concurrent claim test', 1, NULL)`,
      [parcelId],
    );

    const claim = (cookie) =>
      request(`/api/parcels/${parcelId}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status_update: "Picked Up" }),
      });

    const [resultA, resultB] = await Promise.all([
      claim(courierCookie),
      claim(courier2Cookie),
    ]);

    const statuses = [resultA.status, resultB.status].sort();
    const winners = [resultA, resultB].filter((r) => r.status >= 200 && r.status < 300);
    assert.equal(winners.length, 1, "exactly one concurrent claim should succeed");
    // The loser is rejected as not-found because once claimed, the parcel's
    // latest log no longer matches the unassigned-pool scope for the other
    // courier (courier_id is no longer NULL).
    assert.deepEqual(statuses, [201, 404].sort(), "one 201 winner, one 404 loser");
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (restoreCourier2Branch) {
      await restoreCourier2Branch();
    }
    await pool.end();
  }
});

test("branch delete is blocked while its pool holds a live parcel", { skip: !hasDb }, async () => {
  const coordinatorCookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  let branchId;
  let addressId;
  let parcelId;
  try {
    const created = await request("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({
        branch_name: `Test Branch ${process.pid}`,
        contact_number: "+639170001234",
        province: "Cebu",
        city_municipality: "Cebu City",
        barangay: "Test Barangay",
        street_address: "1 Test St",
        postal_code: "6000",
      }),
    });
    assert.equal(created.status, 201);
    branchId = created.body.branch_id;
    addressId = created.body.address_id;

    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Branch delete guard test', $2, NULL)`,
      [parcelId, branchId],
    );

    const blockedDelete = await request(`/api/branches/${branchId}`, {
      method: "DELETE",
      headers: { Cookie: coordinatorCookie },
    });
    assert.equal(blockedDelete.status, 409);
    assert.match(blockedDelete.body.error.message, /1/, "message should mention the stranded count");

    // Make the parcel terminal, then deletion should succeed.
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Delivered', 'Terminal for cleanup', $2, NULL)`,
      [parcelId, branchId],
    );

    const okDelete = await request(`/api/branches/${branchId}`, {
      method: "DELETE",
      headers: { Cookie: coordinatorCookie },
    });
    assert.equal(okDelete.status, 204);
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (branchId) {
      await pool.query("DELETE FROM branches WHERE branch_id = $1", [branchId]);
    }
    if (addressId) {
      await pool.query("DELETE FROM addresses WHERE address_id = $1", [addressId]);
    }
    await pool.end();
  }
});

test("deactivated courier loses list and write access", { skip: !hasDb }, async () => {
  const coordinatorCookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  const stamp = `${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `disposable-courier-${stamp}@linko.test`;
  const password = "Password123!";
  let userId;
  let businessId;
  let courierId;
  let parcelId;
  try {
    const { hashPassword } = await import("./auth/passwords.js");
    const passwordHash = await hashPassword(password);

    userId = (
      await pool.query(
        `INSERT INTO users (username, email, full_name, password_hash, role)
         VALUES ($1, $2, 'Disposable Courier', $3, 'staff')
         RETURNING user_id`,
        [`disposable_courier_${stamp}`, email, passwordHash],
      )
    ).rows[0].user_id;

    businessId = (
      await pool.query(
        `INSERT INTO businesses (business_name, business_type, contact_number)
         VALUES ($1, 'individual', '+639170009999')
         RETURNING business_id`,
        [`Disposable Courier Biz ${stamp}`],
      )
    ).rows[0].business_id;

    await pool.query("INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)", [
      userId,
      businessId,
    ]);
    await pool.query(
      "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, 'courier')",
      [userId, businessId],
    );
    courierId = (
      await pool.query(
        `INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id, user_id)
         VALUES ('Disposable Courier', '+639170009999', 'motorcycle', 1, $1)
         RETURNING courier_id`,
        [userId],
      )
    ).rows[0].courier_id;

    // Confirm the fixture actually works before deactivating it.
    const cookie = await loginAs(email, password);
    const beforeList = await request("/api/parcels", { headers: { Cookie: cookie } });
    assert.equal(beforeList.status, 200, "active courier should be able to list parcels");

    const deactivate = await request(`/api/couriers/${courierId}`, {
      method: "DELETE",
      headers: { Cookie: coordinatorCookie },
    });
    assert.equal(deactivate.status, 204);

    // A pool parcel in branch 1 to attempt a scan against.
    parcelId = await createParcel(pool);
    await pool.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, 'Order Created', 'Deactivated courier test', 1, NULL)`,
      [parcelId],
    );

    const afterCookie = await loginAs(email, password);

    const afterList = await request("/api/parcels", { headers: { Cookie: afterCookie } });
    assert.equal(afterList.status, 200, "deactivated courier's list call should not error");
    assert.deepEqual(afterList.body.items, [], "deactivated courier should see an empty pool, not an error");

    const scan = await request(`/api/parcels/${parcelId}/tracking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: afterCookie },
      body: JSON.stringify({ status_update: "Picked Up" }),
    });
    assert.equal(scan.status, 403, "deactivated courier should be forbidden from writing a scan");
  } finally {
    if (parcelId) {
      await pool.query("DELETE FROM parcels WHERE parcel_id = $1", [parcelId]);
    }
    if (courierId) {
      await pool.query("DELETE FROM couriers WHERE courier_id = $1", [courierId]);
    }
    if (userId) {
      await pool.query("DELETE FROM business_memberships WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);
    }
    if (businessId) {
      await pool.query("DELETE FROM businesses WHERE business_id = $1", [businessId]);
    }
    if (userId) {
      await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
    }
    await pool.end();
  }
});

test("coordinator edits a courier's logistics fields via PATCH", { skip: !hasDb }, async () => {
  const coordinatorCookie = await loginAs("logistics@linko.test");
  const pool = createPool();
  let courierId;
  try {
    // Disposable courier assigned to branch 1.
    courierId = (
      await pool.query(
        `INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id)
         VALUES ('PATCH Fixture', '+639170000000', 'bike', 1)
         RETURNING courier_id`,
      )
    ).rows[0].courier_id;

    // Reassign branch + update vehicle. Branch 2 exists in the seed.
    const updated = await request(`/api/couriers/${courierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ vehicle_type: "Van", assigned_branch_id: 2 }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.vehicle_type, "Van");
    assert.equal(updated.body.assigned_branch_id, 2);
    assert.equal(updated.body.phone_number, "+639170000000", "omitted field unchanged");

    // Explicit null unassigns the branch.
    const unassigned = await request(`/api/couriers/${courierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ assigned_branch_id: null }),
    });
    assert.equal(unassigned.status, 200);
    assert.equal(unassigned.body.assigned_branch_id, null);

    // Unknown courier -> 404.
    const missing = await request("/api/couriers/999999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ vehicle_type: "Truck" }),
    });
    assert.equal(missing.status, 404);

    // Inactive/unknown branch -> 400.
    const badBranch = await request(`/api/couriers/${courierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: coordinatorCookie },
      body: JSON.stringify({ assigned_branch_id: 999999 }),
    });
    assert.equal(badBranch.status, 400);
    assert.match(badBranch.body.error.message, /active branch/i);
  } finally {
    if (courierId) {
      await pool.query("DELETE FROM couriers WHERE courier_id = $1", [courierId]);
    }
    await pool.end();
  }
});
