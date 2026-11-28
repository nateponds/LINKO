import { Router } from "express";
import { query, getPool } from "../../db.js";
import { requireAnyRole, requireAuth } from "../../middleware/auth.js";
import { validateCoordinatePair } from "../../services/location.js";
import {
  buildPaginatedResponse,
  parsePaginationQuery,
} from "../../services/pagination.js";
import {
  asClientError,
  createHttpError,
  hasOwn,
  LATEST_PARCEL_LOG_SQL,
  LOGISTICS_OPS_ROLES,
  LOGISTICS_REFERENCE_READ_ROLES,
  TERMINAL_TRACKING_STATUS_LIST,
} from "./shared.js";

const router = Router();

const BRANCH_ADDRESS_FIELDS = [
  "province",
  "city_municipality",
  "barangay",
  "street_address",
  "postal_code",
];
const REQUIRED_BRANCH_FIELDS = ["branch_name", "province", "city_municipality"];

function normalizeBranchText(body, field, { required = false } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const value = body[field];
  if (value === null && !required) {
    return null;
  }
  if (typeof value !== "string" || (required && value.trim() === "")) {
    throw createHttpError(
      400,
      `${field} must be ${required ? "a non-empty string" : "a string or null"}`,
    );
  }
  return value.trim();
}

async function selectBranch(db, branchId, { includeActive = false } = {}) {
  const { rows } = await db.query(
    `SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
            b.is_available${includeActive ? ", b.is_active" : ""},
            a.province, a.city_municipality, a.barangay, a.street_address,
            a.postal_code, a.latitude::float8 AS latitude,
            a.longitude::float8 AS longitude
       FROM branches b
       JOIN addresses a ON a.address_id = b.address_id
      WHERE b.branch_id = $1 AND b.is_active`,
    [branchId],
  );
  return rows[0] ?? null;
}

router.get(
  "/branches",
  requireAuth,
  requireAnyRole(LOGISTICS_REFERENCE_READ_ROLES),
  async (req, res) => {
    const filters = parsePaginationQuery(req.query);
    const params = [];
    let search = "";
    if (filters.q) {
      params.push(filters.q);
      const qParam = params.length;
      search = ` AND (b.branch_name ILIKE '%' || $${qParam} || '%'
        OR a.province ILIKE '%' || $${qParam} || '%'
        OR a.city_municipality ILIKE '%' || $${qParam} || '%'
        OR a.barangay ILIKE '%' || $${qParam} || '%')`;
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total_items
         FROM branches b
         JOIN addresses a ON a.address_id = b.address_id
        WHERE b.is_active${search}`,
      params,
    );
    params.push(filters.limit, filters.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;
    const { rows } = await query(
      `
      SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
             b.is_available,
             a.province, a.city_municipality, a.barangay, a.street_address,
             a.postal_code, a.latitude::float8 AS latitude,
             a.longitude::float8 AS longitude
        FROM branches b
        JOIN addresses a ON a.address_id = b.address_id
       WHERE b.is_active${search}
       ORDER BY b.branch_id ASC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    res.json(buildPaginatedResponse(rows, filters, countRows[0].total_items));
  },
);

router.get(
  "/branches/options",
  requireAuth,
  requireAnyRole(LOGISTICS_REFERENCE_READ_ROLES),
  async (_req, res) => {
    const { rows } = await query(`
      SELECT branch_id, branch_name
        FROM branches
       WHERE is_active
       ORDER BY branch_name ASC, branch_id ASC`);
    res.json(rows);
  },
);

router.post(
  "/branches",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const body = req.body ?? {};
      const text = {};
      for (const field of [
        "branch_name",
        "contact_number",
        ...BRANCH_ADDRESS_FIELDS,
      ]) {
        text[field] = normalizeBranchText(body, field, {
          required: REQUIRED_BRANCH_FIELDS.includes(field),
        });
      }
      for (const field of REQUIRED_BRANCH_FIELDS) {
        if (text[field] === undefined) {
          throw createHttpError(400, `${field} is required`);
        }
      }

      const latitudeProvided = hasOwn(body, "latitude");
      const longitudeProvided = hasOwn(body, "longitude");
      if (latitudeProvided !== longitudeProvided) {
        throw createHttpError(
          400,
          "latitude and longitude must be provided together",
        );
      }
      const coords = validateCoordinatePair(body.latitude, body.longitude);
      if (!coords.ok) {
        throw createHttpError(400, coords.error);
      }

      await client.query("BEGIN");
      const addr = await client.query(
        `INSERT INTO addresses
           (province, city_municipality, barangay, street_address, postal_code, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING address_id`,
        [
          text.province,
          text.city_municipality,
          text.barangay ?? null,
          text.street_address ?? null,
          text.postal_code ?? null,
          coords.latitude,
          coords.longitude,
        ],
      );
      const branch = await client.query(
        `INSERT INTO branches (branch_name, contact_number, address_id)
         VALUES ($1, $2, $3) RETURNING branch_id`,
        [text.branch_name, text.contact_number ?? null, addr.rows[0].address_id],
      );
      const created = await selectBranch(client, branch.rows[0].branch_id, {
        includeActive: true,
      });
      await client.query("COMMIT");
      res.status(201).json(created);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(e));
    } finally {
      client.release();
    }
  },
);

// Partial branch management update. Branch metadata and its ownerless address
// are locked and changed in one transaction so callers never observe a mixed
// old/new location. An availability-only PATCH deliberately leaves the address
// untouched; an explicit null coordinate pair unpins the branch.
router.patch(
  "/branches/:id",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (req, res, next) => {
    const client = await getPool().connect();
    try {
      const body = req.body ?? {};
      const text = {};
      for (const field of [
        "branch_name",
        "contact_number",
        ...BRANCH_ADDRESS_FIELDS,
      ]) {
        text[field] = normalizeBranchText(body, field, {
          required: REQUIRED_BRANCH_FIELDS.includes(field),
        });
      }
      if (hasOwn(body, "is_available") && typeof body.is_available !== "boolean") {
        throw createHttpError(400, "is_available must be a boolean");
      }

      const latitudeProvided = hasOwn(body, "latitude");
      const longitudeProvided = hasOwn(body, "longitude");
      if (latitudeProvided !== longitudeProvided) {
        throw createHttpError(
          400,
          "latitude and longitude must be provided together",
        );
      }
      const coordinatesProvided = latitudeProvided;
      const coords = coordinatesProvided
        ? validateCoordinatePair(body.latitude, body.longitude)
        : null;
      if (coords && !coords.ok) {
        throw createHttpError(400, coords.error);
      }
      const addressUpdateProvided =
        BRANCH_ADDRESS_FIELDS.some((field) => hasOwn(body, field)) ||
        coordinatesProvided;
      const branchUpdateProvided =
        hasOwn(body, "branch_name") ||
        hasOwn(body, "contact_number") ||
        hasOwn(body, "is_available");

      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
                b.is_available, a.province, a.city_municipality, a.barangay,
                a.street_address, a.postal_code, a.latitude, a.longitude
           FROM branches b
           JOIN addresses a ON a.address_id = b.address_id
          WHERE b.branch_id = $1 AND b.is_active
          FOR UPDATE OF b, a`,
        [req.params.id],
      );
      const current = rows[0];
      if (!current) {
        throw createHttpError(404, `Branch ${req.params.id} not found`);
      }

      const valueFor = (field) =>
        text[field] === undefined ? current[field] : text[field];
      if (addressUpdateProvided) {
        await client.query(
          `UPDATE addresses
              SET province = $2, city_municipality = $3, barangay = $4,
                  street_address = $5, postal_code = $6, latitude = $7, longitude = $8
            WHERE address_id = $1`,
          [
            current.address_id,
            valueFor("province"),
            valueFor("city_municipality"),
            valueFor("barangay"),
            valueFor("street_address"),
            valueFor("postal_code"),
            coords ? coords.latitude : current.latitude,
            coords ? coords.longitude : current.longitude,
          ],
        );
      }
      if (branchUpdateProvided) {
        await client.query(
          `UPDATE branches
              SET branch_name = $2, contact_number = $3, is_available = $4
            WHERE branch_id = $1`,
          [
            current.branch_id,
            valueFor("branch_name"),
            valueFor("contact_number"),
            hasOwn(body, "is_available")
              ? body.is_available
              : current.is_available,
          ],
        );
      }

      const updated = await selectBranch(client, current.branch_id);
      await client.query("COMMIT");
      res.json(updated);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(e));
    } finally {
      client.release();
    }
  },
);

// Soft delete: hide from management lists but keep parcel history intact
// (tracking_logs still reference the row). Deleting a branch also unassigns
// its couriers so the courier list does not point at a hidden branch.
router.delete(
  "/branches/:id",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (req, res, next) => {
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
          ${LATEST_PARCEL_LOG_SQL}
         WHERE latest.branch_id = $1
           AND latest.courier_id IS NULL
           AND latest.status_update <> ALL($2::text[])`,
        [req.params.id, TERMINAL_TRACKING_STATUS_LIST],
      );
      const strandedCount = Number(stranded.rows[0].count);
      if (strandedCount > 0) {
        throw createHttpError(
          409,
          `Cannot deactivate branch: ${strandedCount} live parcel(s) in its unassigned pool; reassign them first`,
        );
      }

      const { rowCount } = await client.query(
        "UPDATE branches SET is_active = false WHERE branch_id = $1 AND is_active",
        [req.params.id],
      );
      if (!rowCount) {
        throw createHttpError(404, `Branch ${req.params.id} not found`);
      }
      await client.query(
        "UPDATE couriers SET assigned_branch_id = NULL WHERE assigned_branch_id = $1",
        [req.params.id],
      );
      await client.query("COMMIT");
      res.status(204).end();
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(e));
    } finally {
      client.release();
    }
  },
);

export default router;
