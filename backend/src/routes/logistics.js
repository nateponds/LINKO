import { Router } from "express";
import { query, getPool, nextParcelId } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";
import {
  getActiveMembership,
  isPlatformAdmin,
} from "../middleware/ownership.js";
import { notifyBusiness } from "../services/notify.js";

const router = Router();

const TRACKING_STATUS_RANK = {
  "Order Created": 0,
  "Picked Up": 1,
  "In Transit": 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Returned: 4,
  Cancelled: 4,
};
const VALID_TRACKING_STATUSES = [
  "Order Created",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Returned",
  "Cancelled",
];
const COURIER_TRACKING_STATUSES = new Set(VALID_TRACKING_STATUSES.filter((status) => status !== "Cancelled"));
const TERMINAL_TRACKING_STATUSES = new Set(["Delivered", "Returned", "Cancelled"]);

// Course-deliverable routes (Sprint 2-CD): expose the 002/003 logistics
// subsystem for the demo UI. Shapes documented in docs/API_CONTRACTS.md.

// PostgreSQL constraint violations mean the client sent bad references or
// values, not that the server broke. Map them to 400 instead of 500.
// 23503 = foreign key violation, 23514 = check violation, 23505 = unique.
function asClientError(error) {
  if (["23503", "23514", "23505"].includes(error.code)) {
    error.statusCode = 400;
  }
  return error;
}

export function canCourierSubmitTrackingStatus(currentStatus, nextStatus) {
  if (!COURIER_TRACKING_STATUSES.has(nextStatus)) {
    return {
      allowed: false,
      message: "Couriers cannot cancel parcels; use Returned for failed delivery outcomes.",
    };
  }

  if (!currentStatus) return { allowed: true };

  if (TERMINAL_TRACKING_STATUSES.has(currentStatus)) {
    return {
      allowed: false,
      message: `Courier cannot update terminal parcel status ${currentStatus}`,
    };
  }

  if (TRACKING_STATUS_RANK[nextStatus] < TRACKING_STATUS_RANK[currentStatus]) {
    return {
      allowed: false,
      message: `Courier cannot move backward from ${currentStatus} to ${nextStatus}`,
    };
  }

  return { allowed: true };
}

// Current status lives in tracking_logs (latest row by scanned_at), never on
// parcels -- see docs/LINKO_ERD.md design notes.
const LATEST_LOG = `
  LEFT JOIN LATERAL (
    SELECT status_update, scanned_at, courier_id, branch_id
      FROM tracking_logs tl
     WHERE tl.parcel_id = p.parcel_id
     ORDER BY tl.scanned_at DESC, tl.log_id DESC
     LIMIT 1
  ) latest ON TRUE`;

async function findBranchIdByCity(client, cityMunicipality) {
  if (!cityMunicipality) return null;
  const { rows } = await client.query(
    `SELECT b.branch_id
       FROM branches b
       JOIN addresses a ON a.address_id = b.address_id
      WHERE LOWER(a.city_municipality) = LOWER($1)
      LIMIT 1`,
    [cityMunicipality],
  );
  return rows[0]?.branch_id ?? null;
}

router.use(
  "/parcels",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

router.use(
  "/service-tiers",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

// Branches and couriers are logistics reference data. Reads (GET) were
// previously UNAUTHENTICATED; gate the whole path so only logistics-adjacent
// roles may read. Writes add their own tighter role guard per-route below.
router.use(
  "/branches",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

router.use(
  "/couriers",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

// Row-level parcel visibility for the current caller:
//   { all: true }              -> logistics_coordinator or platform_admin
//   { businessIds: [...] }     -> wholesaler: parcels they send OR receive
//   { courierId, courierBranchId } -> courier: history plus branch pickup pool
// Resolved once per request; used to build the WHERE clause in the house style.
async function parcelScope(req) {
  const { user, memberships } = req.auth;
  if (isPlatformAdmin(user) || memberships.some((m) => m.role === "logistics_coordinator")) {
    return { all: true };
  }

  const businessIds = memberships
    .filter((m) => m.role === "wholesaler")
    .map((m) => m.business_id);
  if (businessIds.length) {
    return { businessIds };
  }

  const { rows } = await query(
    "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = $1 AND is_active",
    [user.user_id],
  );
  return {
    courierId: rows[0]?.courier_id ?? null,
    courierBranchId: rows[0]?.assigned_branch_id ?? null,
  };
}

router.get("/parcels", async (req, res) => {
  const scope = await parcelScope(req);

  let filterClause = "";
  const params = [];

  if (scope.businessIds) {
    params.push(scope.businessIds);
    filterClause = `WHERE (p.sender_id = ANY($${params.length}::int[])
                       OR p.receiver_id = ANY($${params.length}::int[]))`;
  } else if (scope.courierId !== undefined && !scope.all) {
    // Courier sees parcels they have handled plus their branch's unassigned
    // pickup pool -- docs/delivery-status-logistics.md. A courier with no
    // assigned branch sees handling history only; see Sprint 7
    // anti-leak/pool-strictness contract below.
    params.push(scope.courierId);
    const courierParam = params.length;
    const historyClause = `EXISTS (SELECT 1 FROM tracking_logs h
               WHERE h.parcel_id = p.parcel_id AND h.courier_id = $${courierParam})`;

    if (scope.courierBranchId !== null) {
      params.push(scope.courierBranchId);
      const branchParam = params.length;
      filterClause = `WHERE (
        ${historyClause}
        OR (latest.courier_id IS NULL
            AND latest.branch_id = $${branchParam})
      )`;
    } else {
      // No assigned branch -> no pool clause at all: a null-branch courier
      // sees only parcels present in their own handling history, never any
      // pickup pool (including branchless-latest-log parcels). See Sprint 7
      // anti-leak/pool-strictness contract.
      filterClause = `WHERE (${historyClause})`;
    }
  }

  const { rows } = await query(`
    SELECT p.parcel_id,
           json_build_object('business_id', s.business_id, 'business_name', s.business_name) AS sender,
           json_build_object('business_id', r.business_id, 'business_name', r.business_name) AS receiver,
           st.tier_name,
           p.weight_kg::float8,
           p.shipping_fee::float8,
           p.estimated_delivery_date,
           latest.status_update AS current_status,
           latest.scanned_at    AS last_scanned_at,
           latest.courier_id    AS latest_courier_id
      FROM parcels p
      JOIN businesses s      ON s.business_id = p.sender_id
      JOIN businesses r      ON r.business_id = p.receiver_id
      JOIN service_tiers st ON st.tier_id = p.tier_id
      ${LATEST_LOG}
      ${filterClause}
     ORDER BY latest.scanned_at DESC NULLS LAST`, params);

  res.json(rows);
});

router.get("/parcels/:id", async (req, res) => {
  const scope = await parcelScope(req);
  const { rows } = await query(
    `
    SELECT p.parcel_id,
           p.sender_id, p.receiver_id,
           json_build_object('business_id', s.business_id, 'business_name', s.business_name,
                             'contact_number', s.contact_number) AS sender,
           json_build_object('business_id', r.business_id, 'business_name', r.business_name,
                             'contact_number', r.contact_number) AS receiver,
           json_build_object('tier_id', st.tier_id, 'tier_name', st.tier_name,
                             'estimated_days', st.estimated_days) AS tier,
           json_build_object('province', o.province, 'city_municipality', o.city_municipality,
                             'barangay', o.barangay, 'street_address', o.street_address,
                             'postal_code', o.postal_code) AS origin_address,
           json_build_object('province', d.province, 'city_municipality', d.city_municipality,
                             'barangay', d.barangay, 'street_address', d.street_address,
                             'postal_code', d.postal_code) AS destination_address,
           p.weight_kg::float8, p.dimensions, p.declared_value::float8,
           p.shipping_fee::float8, p.total_distance_km::float8,
           p.estimated_delivery_date,
           json_build_object('method', pay.method, 'payment_status', pay.payment_status,
                             'amount', pay.amount, 'paid_at', pay.paid_at) AS payment,
           latest.status_update AS current_status,
           latest.courier_id AS latest_courier_id,
           latest.branch_id AS latest_branch_id,
           (SELECT json_agg(json_build_object(
                      'status_update', tl.status_update,
                      'branch_name', b.branch_name,
                      'courier_name', c.full_name,
                      'remarks', tl.remarks,
                      'scanned_at', tl.scanned_at)
                    ORDER BY tl.scanned_at, tl.log_id)
              FROM tracking_logs tl
              LEFT JOIN branches b ON b.branch_id = tl.branch_id
              LEFT JOIN couriers c ON c.courier_id = tl.courier_id
             WHERE tl.parcel_id = p.parcel_id) AS tracking_history
      FROM parcels p
      JOIN businesses s      ON s.business_id = p.sender_id
      JOIN businesses r      ON r.business_id = p.receiver_id
      JOIN service_tiers st ON st.tier_id = p.tier_id
      JOIN addresses o      ON o.address_id = p.origin_address_id
      JOIN addresses d      ON d.address_id = p.destination_address_id
      LEFT JOIN payments pay ON pay.parcel_id = p.parcel_id
      ${LATEST_LOG}
     WHERE p.parcel_id = $1`,
    [req.params.id],
  );

  if (!rows.length) {
    return res.status(404).json({
      error: { message: `Parcel ${req.params.id} not found` },
    });
  }

  // Ownership: same rule as the list. A caller who cannot see this parcel gets
  // a 404 (not 403) so parcel existence is not leaked -- matches the not-found
  // response above.
  const parcel = rows[0];
  let courierHistoryVisible = false;
  if (scope.courierId !== undefined && scope.courierId !== null) {
    const history = await query(
      `SELECT EXISTS (
         SELECT 1 FROM tracking_logs h
          WHERE h.parcel_id = $1 AND h.courier_id = $2
       ) AS visible`,
      [parcel.parcel_id, scope.courierId],
    );
    courierHistoryVisible = history.rows[0].visible;
  }

  const courierPoolVisible =
    scope.courierId !== undefined &&
    parcel.latest_courier_id === null &&
    parcel.latest_branch_id !== null &&
    scope.courierBranchId !== null &&
    parcel.latest_branch_id === scope.courierBranchId;

  const visible =
    scope.all ||
    (scope.businessIds &&
      (scope.businessIds.includes(parcel.sender_id) ||
        scope.businessIds.includes(parcel.receiver_id))) ||
    courierHistoryVisible ||
    courierPoolVisible;

  if (!visible) {
    return res.status(404).json({
      error: { message: `Parcel ${req.params.id} not found` },
    });
  }

  // Strip the internal-only fields used for the ownership check.
  delete parcel.sender_id;
  delete parcel.receiver_id;

  res.json(parcel);
});

router.post(
  "/parcels",
  requireAnyRole(["wholesaler", "logistics_coordinator", "platform_admin"]),
  async (req, res, next) => {
  const {
    sender_id,
    receiver_id,
    tier_id,
    origin_address_id,
    destination_address_id,
    weight_kg,
    dimensions,
    declared_value,
    total_distance_km,
    payment_method,
  } = req.body ?? {};

  // The validation-middleware task belongs to Sprint 2 proper; until it
  // lands, check the minimum needed for a sane insert here.
  const required = {
    sender_id,
    receiver_id,
    tier_id,
    origin_address_id,
    destination_address_id,
    weight_kg,
    payment_method,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === undefined || value === null)
    .map(([key]) => key);

  if (missing.length) {
    return res.status(400).json({
      error: { message: `Missing required fields: ${missing.join(", ")}` },
    });
  }
  if (Number(weight_kg) <= 0 || Number.isNaN(Number(weight_kg))) {
    return res.status(400).json({
      error: { message: "weight_kg must be a number greater than 0" },
    });
  }
  if (!["COD", "Prepaid", "Online"].includes(payment_method)) {
    return res.status(400).json({
      error: { message: "payment_method must be one of COD, Prepaid, Online" },
    });
  }

  // Sender must be derived from the caller's own business, never trusted from
  // the body. A wholesaler can only send parcels as one of their businesses:
  // resolve the active wholesaler membership and reject any body sender_id that
  // does not match it. Logistics coordinators and platform admins operate the
  // whole network, so they may book on behalf of any sender business.
  let effectiveSenderId = sender_id;
  const isWholesaler = req.auth.memberships.some((m) => m.role === "wholesaler");
  if (!isPlatformAdmin(req.auth.user) && isWholesaler) {
    let ownBusinessId;
    try {
      ownBusinessId = getActiveMembership(req, ["wholesaler"]).business_id;
    } catch (error) {
      return next(error);
    }
    if (Number(sender_id) !== ownBusinessId) {
      return res.status(403).json({
        error: { message: "sender_id must be your own business" },
      });
    }
    effectiveSenderId = ownBusinessId;
  }

  // One transaction: parcel + payment + first tracking log all appear or
  // none do. The 003 triggers fill shipping_fee, payments.amount, and the
  // commission row along the way.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const parcelId = await nextParcelId(client);

    const { rows } = await client.query(
      `
      INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                           origin_address_id, destination_address_id,
                           weight_kg, dimensions, declared_value,
                           total_distance_km, estimated_delivery_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), $10,
              CURRENT_DATE + (SELECT estimated_days FROM service_tiers WHERE tier_id = $4))
      RETURNING parcel_id, shipping_fee::float8, declared_value::float8, estimated_delivery_date`,
      [
        parcelId,
        effectiveSenderId,
        receiver_id,
        tier_id,
        origin_address_id,
        destination_address_id,
        weight_kg,
        dimensions ?? null,
        declared_value ?? null,
        total_distance_km ?? null,
      ],
    );

    await client.query(
      `INSERT INTO payments (parcel_id, method, payment_status, amount)
       VALUES ($1, $2, 'Pending', NULL)`,
      [parcelId, payment_method],
    );

    const originAddress = await client.query(
      "SELECT city_municipality FROM addresses WHERE address_id = $1",
      [origin_address_id],
    );
    const originBranchId = await findBranchIdByCity(
      client,
      originAddress.rows[0]?.city_municipality,
    );

    await client.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id)
       VALUES ($1, 'Order Created', 'Booking confirmed', $2)`,
      [parcelId, originBranchId],
    );

    await client.query("COMMIT");

    res.status(201).json({ ...rows[0], current_status: "Order Created" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(error));
  } finally {
    client.release();
  }
});

router.get("/service-tiers", async (_req, res) => {
  const { rows } = await query(`
    SELECT tier_id, tier_name, base_fee::float8, base_rate_per_kg::float8,
           rate_per_km::float8, estimated_days
      FROM service_tiers
     ORDER BY tier_id`);

  res.json(rows);
});

router.get("/branches", async (_req, res) => {
  const { rows } = await query(`
    SELECT b.branch_id, b.branch_name, b.contact_number,
           a.province, a.city_municipality, a.barangay, a.street_address
      FROM branches b
      JOIN addresses a ON a.address_id = b.address_id
     WHERE b.is_active
     ORDER BY b.branch_id`);
  res.json(rows);
});

router.get("/couriers", async (_req, res) => {
  const { rows } = await query(`
    SELECT courier_id, full_name, phone_number, vehicle_type, assigned_branch_id
      FROM couriers
     WHERE is_active
     ORDER BY full_name`);
  res.json(rows);
});

router.post("/parcels/:id/tracking", requireAnyRole(["logistics_coordinator", "courier", "platform_admin"]), async (req, res, next) => {
  const parcelId = req.params.id;
  const { status_update, remarks, branch_id, courier_id } = req.body ?? {};

  if (!VALID_TRACKING_STATUSES.includes(status_update)) {
    return res.status(400).json({
      error: { message: "Invalid status_update" },
    });
  }

  // Couriers act as themselves: stamp courier_id and home branch from their
  // linked couriers row and ignore client-supplied values (no spoofing).
  // Coordinators/admins may assign explicitly.
  let effectiveCourierId = courier_id || null;
  let effectiveBranchId = branch_id || null;
  const isPrivileged =
    isPlatformAdmin(req.auth.user) ||
    req.auth.memberships.some((m) => m.role === "logistics_coordinator");
  if (!isPrivileged) {
    const { rows } = await query(
      "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = $1 AND is_active",
      [req.auth.user.user_id],
    );
    if (!rows.length) {
      return res.status(403).json({
        error: { message: "Your account is not linked to an active courier profile" },
      });
    }
    effectiveCourierId = rows[0].courier_id;
    effectiveBranchId = rows[0].assigned_branch_id ?? null;
  }

  // Transaction: the scan and its order side effect commit together.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const lock = await client.query(
      "SELECT parcel_id FROM parcels WHERE parcel_id = $1 FOR UPDATE",
      [parcelId],
    );
    if (lock.rowCount === 0) {
      const error = new Error(`Parcel ${parcelId} not found`);
      error.statusCode = 404;
      throw error;
    }

    // Coordinators/admins may assign branch_id/courier_id explicitly from the
    // body (unlike the courier path below, which is server-stamped) -- so
    // those client-supplied references need their own active check.
    if (isPrivileged) {
      if (effectiveBranchId !== null) {
        const activeBranch = await client.query(
          "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
          [effectiveBranchId],
        );
        if (!activeBranch.rowCount) {
          const error = new Error("branch_id must reference an active branch");
          error.statusCode = 400;
          throw error;
        }
      }
      if (effectiveCourierId !== null) {
        const activeCourier = await client.query(
          "SELECT 1 FROM couriers WHERE courier_id = $1 AND is_active",
          [effectiveCourierId],
        );
        if (!activeCourier.rowCount) {
          const error = new Error("courier_id must reference an active courier");
          error.statusCode = 400;
          throw error;
        }
      }
    }

    if (!isPrivileged) {
      const current = await client.query(
        `SELECT status_update, courier_id, branch_id
           FROM tracking_logs
          WHERE parcel_id = $1
          ORDER BY scanned_at DESC, log_id DESC
          LIMIT 1`,
        [parcelId],
      );

      const courierStatusRule = canCourierSubmitTrackingStatus(
        current.rows[0]?.status_update,
        status_update,
      );
      if (!courierStatusRule.allowed) {
        const error = new Error(courierStatusRule.message);
        error.statusCode = 400;
        throw error;
      }

      // Write scope mirrors the anti-leak GET: history on this parcel, or an
      // unassigned branch-pool match by strict equality (no NULL-to-NULL match).
      const history = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM tracking_logs h
            WHERE h.parcel_id = $1 AND h.courier_id = $2
         ) AS visible`,
        [parcelId, effectiveCourierId],
      );
      const latest = current.rows[0];
      const inBranchPool =
        !!latest &&
        latest.courier_id === null &&
        latest.branch_id !== null &&
        effectiveBranchId !== null &&
        latest.branch_id === effectiveBranchId;
      if (!history.rows[0].visible && !inBranchPool) {
        const error = new Error(`Parcel ${parcelId} not found`);
        error.statusCode = 404;
        throw error;
      }
    }

    if (effectiveBranchId === null) {
      const carried = await client.query(
        `SELECT branch_id
           FROM tracking_logs
          WHERE parcel_id = $1 AND branch_id IS NOT NULL
          ORDER BY scanned_at DESC, log_id DESC
          LIMIT 1`,
        [parcelId],
      );
      effectiveBranchId = carried.rows[0]?.branch_id ?? null;
    }

    // Coordinator/admin logs without courier_id deliberately unassign the
    // parcel back to the effective branch pool; courier_id is not carried.
    const { rows } = await client.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parcelId, status_update, remarks || null, effectiveBranchId, effectiveCourierId]
    );

    // Terminal delivery scans complete the linked marketplace order -- the
    // wholesaler's fulfillment control ended at 'shipped'
    // (docs/delivery-status-logistics.md).
    if (status_update === "Delivered") {
      const { rows: orderRows } = await client.query(
        `UPDATE orders o
            SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
           FROM parcels p
          WHERE p.parcel_id = $1
            AND o.order_id = p.order_id
            AND o.status = 'shipped'
        RETURNING o.order_id, o.buyer_business_id`,
        [parcelId],
      );
      if (orderRows.length) {
        await notifyBusiness(
          client,
          orderRows[0].buyer_business_id,
          "Order Delivered",
          `Order #${orderRows[0].order_id} is now delivered.`,
          "success",
        );
      }
    }

    if (status_update === "Returned") {
      const { rows: orderRows } = await client.query(
        `UPDATE orders o
            SET status = 'returned', updated_at = CURRENT_TIMESTAMP
           FROM parcels p
          WHERE p.parcel_id = $1
            AND o.order_id = p.order_id
            AND o.status = 'shipped'
        RETURNING o.order_id, o.buyer_business_id, o.wholesaler_business_id`,
        [parcelId],
      );
      if (orderRows.length) {
        const order = orderRows[0];
        const returnReason =
          typeof remarks === "string"
            ? remarks.trim().replace(/[.]+$/, "")
            : "";
        const buyerMessage = returnReason
          ? `Delivery failed: ${returnReason}. Order #${order.order_id} returned to sender.`
          : `Delivery failed — order #${order.order_id} returned to sender.`;
        const wholesalerMessage = returnReason
          ? `Parcel for order #${order.order_id} is returning to you. Delivery failed: ${returnReason}.`
          : `Parcel for order #${order.order_id} is returning to you.`;

        await notifyBusiness(
          client,
          order.buyer_business_id,
          "Delivery Failed — Order Returned",
          buyerMessage,
          "warning",
        );
        await notifyBusiness(
          client,
          order.wholesaler_business_id,
          "Parcel Returning to Sender",
          wholesalerMessage,
          "warning",
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(error));
  } finally {
    client.release();
  }
});


router.post("/branches", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const { branch_name, contact_number, province, city_municipality, barangay, street_address, postal_code } = req.body;
    await client.query("BEGIN");
    const addr = await client.query(
      `INSERT INTO addresses (province, city_municipality, barangay, street_address, postal_code)
       VALUES ($1, $2, $3, $4, $5) RETURNING address_id`,
      [province, city_municipality, barangay, street_address, postal_code]
    );
    const branch = await client.query(
      `INSERT INTO branches (branch_name, contact_number, address_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [branch_name, contact_number, addr.rows[0].address_id]
    );
    await client.query("COMMIT");
    res.status(201).json(branch.rows[0]);
  } catch(e) {
    await client.query("ROLLBACK").catch(()=>{});
    next(asClientError(e));
  } finally {
    client.release();
  }
});

router.post("/couriers", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  try {
    const { full_name, phone_number, vehicle_type, assigned_branch_id } = req.body;
    if (assigned_branch_id) {
      const active = await query(
        "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
        [assigned_branch_id],
      );
      if (!active.rowCount) {
        return res.status(400).json({
          error: { message: "assigned_branch_id must reference an active branch" },
        });
      }
    }
    const { rows } = await query(
      `INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [full_name, phone_number, vehicle_type, assigned_branch_id || null]
    );
    res.status(201).json(rows[0]);
  } catch(e) {
    next(asClientError(e));
  }
});

// Soft delete: hide from management lists but keep parcel history intact
// (tracking_logs still reference the row). Deleting a branch also unassigns
// its couriers so the courier list does not point at a hidden branch.
router.delete("/branches/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // A branch cannot be deactivated while its unassigned pickup pool is
    // holding live parcels -- those parcels would resolve to no courier's
    // scope (courierBranchId no longer matches an active branch) and become
    // effectively stranded.
    const stranded = await client.query(
      `
      SELECT COUNT(*) AS count
        FROM parcels p
        ${LATEST_LOG}
       WHERE latest.branch_id = $1
         AND latest.courier_id IS NULL
         AND latest.status_update <> ALL($2::text[])`,
      [req.params.id, [...TERMINAL_TRACKING_STATUSES]],
    );
    const strandedCount = Number(stranded.rows[0].count);
    if (strandedCount > 0) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(409).json({
        error: {
          message: `Cannot deactivate branch: ${strandedCount} live parcel(s) in its unassigned pool; reassign them first`,
        },
      });
    }

    const { rowCount } = await client.query(
      "UPDATE branches SET is_active = false WHERE branch_id = $1 AND is_active",
      [req.params.id]
    );
    if (!rowCount) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(404).json({ error: { message: `Branch ${req.params.id} not found` } });
    }
    await client.query(
      "UPDATE couriers SET assigned_branch_id = NULL WHERE assigned_branch_id = $1",
      [req.params.id]
    );
    await client.query("COMMIT");
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(e));
  } finally {
    client.release();
  }
});

router.delete("/couriers/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  try {
    const { rowCount } = await query(
      "UPDATE couriers SET is_active = false WHERE courier_id = $1 AND is_active",
      [req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ error: { message: `Courier ${req.params.id} not found` } });
    }
    res.status(204).end();
  } catch (e) {
    next(asClientError(e));
  }
});

export default router;
