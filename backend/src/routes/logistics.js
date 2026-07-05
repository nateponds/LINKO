import { Router } from "express";
import { query, getPool } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";

const router = Router();

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

// Current status lives in tracking_logs (latest row by scanned_at), never on
// parcels -- see docs/LINKO_ERD.md design notes.
const LATEST_LOG = `
  LEFT JOIN LATERAL (
    SELECT status_update, scanned_at, courier_id
      FROM tracking_logs tl
     WHERE tl.parcel_id = p.parcel_id
     ORDER BY tl.scanned_at DESC
     LIMIT 1
  ) latest ON TRUE`;

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

router.use(
  "/businesses",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

router.get("/parcels", async (req, res) => {
  const isCourierOnly = !req.auth.user.global_role && !req.auth.memberships.some(m => ["logistics_coordinator", "platform_admin", "wholesaler"].includes(m.role));
  
  let filterClause = "";
  let params = [];
  
  if (isCourierOnly) {
    filterClause = "WHERE latest.courier_id = (SELECT courier_id FROM couriers WHERE user_id = $1)";
    params.push(req.auth.user.user_id);
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
           latest.scanned_at    AS last_scanned_at
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
  const { rows } = await query(
    `
    SELECT p.parcel_id,
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
           (SELECT json_agg(json_build_object(
                      'status_update', tl.status_update,
                      'branch_name', b.branch_name,
                      'courier_name', c.full_name,
                      'remarks', tl.remarks,
                      'scanned_at', tl.scanned_at)
                    ORDER BY tl.scanned_at)
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

  res.json(rows[0]);
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

  // ponytail: timestamp-derived tracking number, unique enough for the course
  // demo; swap for a sequence if bookings ever go concurrent.
  const parcelId = `LKO-${Date.now().toString().slice(-8)}`;

  // One transaction: parcel + payment + first tracking log all appear or
  // none do. The 003 triggers fill shipping_fee, payments.amount, and the
  // commission row along the way.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

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
        sender_id,
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

    await client.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks)
       VALUES ($1, 'Order Created', 'Booking confirmed')`,
      [parcelId],
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

// Businesses with their addresses -- the book-a-parcel form needs both to
// fill sender/receiver and origin/destination selects.
router.get("/businesses", async (_req, res) => {
  const { rows } = await query(`
    SELECT b.business_id, b.business_name, b.contact_number, b.business_type,
           COALESCE(json_agg(json_build_object(
                      'address_id', a.address_id,
                      'province', a.province,
                      'city_municipality', a.city_municipality,
                      'barangay', a.barangay,
                      'street_address', a.street_address,
                      'postal_code', a.postal_code)
                    ORDER BY a.address_id)
                    FILTER (WHERE a.address_id IS NOT NULL), '[]') AS addresses
      FROM businesses b
      LEFT JOIN addresses a ON a.business_id = b.business_id
     GROUP BY b.business_id
     ORDER BY b.business_id`);

  res.json(rows);
});

router.get("/branches", async (_req, res) => {
  const { rows } = await query(`
    SELECT b.branch_id, b.branch_name, b.contact_number,
           a.province, a.city_municipality, a.barangay, a.street_address
      FROM branches b
      JOIN addresses a ON a.address_id = b.address_id
     ORDER BY b.branch_id`);
  res.json(rows);
});

router.get("/couriers", async (_req, res) => {
  const { rows } = await query(`
    SELECT courier_id, full_name, phone_number, vehicle_type, assigned_branch_id
      FROM couriers
     ORDER BY full_name`);
  res.json(rows);
});

router.post("/parcels/:id/tracking", requireAnyRole(["logistics_coordinator", "courier", "platform_admin"]), async (req, res, next) => {
  try {
    const parcelId = req.params.id;
    const { status_update, remarks, branch_id, courier_id } = req.body ?? {};

    const validStatuses = [
      'Order Created', 'Picked Up', 'In Transit',
      'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'
    ];

    if (!validStatuses.includes(status_update)) {
      return res.status(400).json({
        error: { message: "Invalid status_update" },
      });
    }

    const { rows } = await query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parcelId, status_update, remarks || null, branch_id || null, courier_id || null]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    next(asClientError(error));
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

export default router;
