import { Router } from "express";
import { getPool, query } from "../db.js";
import { hashPassword } from "../auth/passwords.js";

const router = Router();

// Every route in here is platform-admin only. app.js mounts the router behind
// requireAuth + requireGlobalRole("platform_admin"), so handlers can assume
// req.auth.user.global_role === "platform_admin".

// Postgres constraint violations here mean the client sent a bad value (dup
// email, unknown business, bad role) rather than a server fault. Map to 400 --
// same pattern products.js/logistics.js use. 23503 FK, 23514 CHECK, 23505 UNIQUE.
function asClientError(error) {
  if (["23503", "23514", "23505"].includes(error.code)) {
    error.statusCode = 400;
  }
  return error;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// user_id / business_id are positive-integer SERIALs. Reject anything else so a
// non-numeric :id becomes a clean 404 instead of a 22P02 invalid-input 500.
function parsePositiveId(rawId, label) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(404, `${label} ${rawId} not found`);
  }
  return id;
}

// Privileged account kinds the admin can mint. buyer/wholesaler self-register
// through /api/auth/register, so they are intentionally excluded here.
const PRIVILEGED_KINDS = new Set(["logistics_coordinator", "courier", "platform_admin"]);

// GET /api/admin/users
// All users with their aggregated memberships. Newest first.
router.get("/users", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         u.user_id,
         u.full_name,
         u.email,
         u.global_role,
         u.is_active,
         u.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'business_id', b.business_id,
               'business_name', b.business_name,
               'role', bm.role
             )
             ORDER BY b.business_id, bm.role
           ) FILTER (WHERE bm.membership_id IS NOT NULL),
           '[]'::json
         ) AS memberships
       FROM users u
       LEFT JOIN business_memberships bm ON bm.user_id = u.user_id
       LEFT JOIN businesses b ON b.business_id = bm.business_id
       GROUP BY u.user_id
       ORDER BY u.created_at DESC, u.user_id DESC`,
    );
    res.json(rows);
  } catch (err) {
    next(asClientError(err));
  }
});

// The single org every courier belongs to. Couriers are staff of this one
// business, not businesses of their own, so the server resolves it rather than
// trusting a client business_id. Looked up by name because ids differ per
// environment (migration 022 seeds/renames it).
const CANONICAL_LOGISTICS_BUSINESS = "LINKO Logistics";

// POST /api/admin/users
// Create a privileged user. body: { full_name, email, password, kind, business_id? }
//   kind = platform_admin       -> users.global_role = 'platform_admin', no membership
//   kind = logistics_coordinator -> needs business_id, inserts a membership row
//   kind = courier               -> business_id ignored; membership lands on
//                                   CANONICAL_LOGISTICS_BUSINESS
router.post("/users", async (req, res, next) => {
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : "";

  if (!fullName || !email || !password || !kind) {
    return next(createHttpError(400, "Missing required fields: full_name, email, password, kind"));
  }
  if (!PRIVILEGED_KINDS.has(kind)) {
    return next(
      createHttpError(400, "kind must be logistics_coordinator, courier, or platform_admin"),
    );
  }
  if (password.length < 8) {
    return next(createHttpError(400, "Password must be at least 8 characters long"));
  }

  const isAdminKind = kind === "platform_admin";
  const isCourier = kind === "courier";

  // Couriers resolve their business server-side (below); a client-sent
  // business_id is ignored, not rejected. Coordinators still choose one.
  let businessId = null;
  if (!isAdminKind && !isCourier) {
    businessId = Number(req.body?.business_id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return next(createHttpError(400, "business_id is required for this kind"));
    }
  }

  // Optional courier logistics fields. Ignored for non-courier kinds. Trim empty
  // strings to null so the couriers row keeps NULLs rather than "".
  const phoneNumber =
    typeof req.body?.phone_number === "string" && req.body.phone_number.trim()
      ? req.body.phone_number.trim()
      : null;
  const vehicleType =
    typeof req.body?.vehicle_type === "string" && req.body.vehicle_type.trim()
      ? req.body.vehicle_type.trim()
      : null;
  let assignedBranchId = null;
  if (isCourier && req.body?.assigned_branch_id != null && req.body.assigned_branch_id !== "") {
    assignedBranchId = Number(req.body.assigned_branch_id);
    if (!Number.isInteger(assignedBranchId) || assignedBranchId <= 0) {
      return next(createHttpError(400, "assigned_branch_id must be a positive integer"));
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      throw createHttpError(409, "Email already registered");
    }

    const passwordHash = await hashPassword(password);
    // users.role is the legacy 001 column; 'admin' for platform admins,
    // 'staff' for logistics/courier accounts (mirrors the seed convention).
    const legacyRole = isAdminKind ? "admin" : "staff";
    const globalRole = isAdminKind ? "platform_admin" : null;

    const userResult = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, role, global_role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, full_name, email, global_role, is_active, created_at`,
      [email.slice(0, 50), email, fullName, passwordHash, legacyRole, globalRole],
    );
    const user = userResult.rows[0];

    if (!isAdminKind) {
      let membershipBusinessId = businessId;
      if (isCourier) {
        const canonical = await client.query(
          "SELECT business_id FROM businesses WHERE business_name = $1",
          [CANONICAL_LOGISTICS_BUSINESS],
        );
        if (canonical.rowCount === 0) {
          throw createHttpError(
            500,
            "canonical logistics business missing — run migration 022",
          );
        }
        membershipBusinessId = canonical.rows[0].business_id;
      }
      await client.query(
        "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, $3)",
        [user.user_id, membershipBusinessId, kind],
      );
    }

    // A courier login is useless without a linked couriers row: parcel
    // visibility and tracking scans resolve through couriers.user_id
    // (docs/API_CONTRACTS.md §3.6). This is the sole path that mints a courier
    // with both a login and logistics assignment.
    if (isCourier) {
      if (assignedBranchId !== null) {
        const branch = await client.query(
          "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
          [assignedBranchId],
        );
        if (branch.rowCount === 0) {
          throw createHttpError(400, "assigned_branch_id must reference an active branch");
        }
      }
      await client.query(
        `INSERT INTO couriers (full_name, user_id, phone_number, vehicle_type, assigned_branch_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [fullName, user.user_id, phoneNumber, vehicleType, assignedBranchId],
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ ...user, memberships: [] });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(asClientError(error));
  } finally {
    client.release();
  }
});

// PATCH /api/admin/users/:id
// body: { is_active }. Deactivating also deletes the user's live sessions so the
// change takes effect immediately.
router.patch("/users/:id", async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id, "User");
    const isActive = req.body?.is_active;
    if (typeof isActive !== "boolean") {
      throw createHttpError(400, "is_active must be a boolean");
    }

    const { rows } = await query(
      `UPDATE users SET is_active = $1 WHERE user_id = $2
       RETURNING user_id, full_name, email, global_role, is_active, created_at`,
      [isActive, userId],
    );
    if (rows.length === 0) {
      throw createHttpError(404, `User ${userId} not found`);
    }

    if (isActive === false) {
      await query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
    }

    res.json(rows[0]);
  } catch (err) {
    next(asClientError(err));
  }
});

// GET /api/admin/businesses
// All businesses with a summary of their member users.
router.get("/businesses", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT
         b.business_id,
         b.business_name,
         b.business_type,
         b.is_verified,
         b.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'user_id', u.user_id,
               'full_name', u.full_name,
               'email', u.email,
               'role', bm.role
             )
             ORDER BY u.user_id
           ) FILTER (WHERE bm.membership_id IS NOT NULL),
           '[]'::json
         ) AS members
       FROM businesses b
       LEFT JOIN business_memberships bm ON bm.business_id = b.business_id
       LEFT JOIN users u ON u.user_id = bm.user_id
       GROUP BY b.business_id
       ORDER BY b.created_at DESC, b.business_id DESC`,
    );
    res.json(rows);
  } catch (err) {
    next(asClientError(err));
  }
});

// PATCH /api/admin/businesses/:id
// body: { is_verified } toggle.
router.patch("/businesses/:id", async (req, res, next) => {
  try {
    const businessId = parsePositiveId(req.params.id, "Business");
    const isVerified = req.body?.is_verified;
    if (typeof isVerified !== "boolean") {
      throw createHttpError(400, "is_verified must be a boolean");
    }

    const { rows } = await query(
      `UPDATE businesses SET is_verified = $1 WHERE business_id = $2
       RETURNING business_id, business_name, business_type, is_verified, created_at`,
      [isVerified, businessId],
    );
    if (rows.length === 0) {
      throw createHttpError(404, `Business ${businessId} not found`);
    }

    res.json(rows[0]);
  } catch (err) {
    next(asClientError(err));
  }
});

export default router;
