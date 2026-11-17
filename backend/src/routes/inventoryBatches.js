import { Router } from "express";
import { query } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";
import { createHttpError, getActiveMembership } from "../middleware/ownership.js";
import { buildPaginatedResponse, parsePaginationQuery } from "../services/pagination.js";

const router = Router();
const DEFAULT_EXPIRY_WINDOW_DAYS = 30;
const MAX_EXPIRY_WINDOW_DAYS = 3650;
// Batches describe a wholesaler's own stock; no other role reads or writes them.
const MANAGER_ROLES = ["wholesaler"];
// ponytail: business calendar is fixed to Philippine time (no DST). The DB
// session runs in UTC on Supabase, so CURRENT_DATE would lag a day from
// 00:00-08:00 PHT. Move to a per-business timezone if LINKO leaves PH.
const TODAY = "(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date";

function asClientError(error) {
  if (error.code === "23505") {
    error.statusCode = 400;
    error.message = "batch_number must be unique for this product";
  } else if (["23503", "23514"].includes(error.code)) {
    error.statusCode = 400;
    error.message = "Inventory batch data violates a database constraint";
  }
  return error;
}

function readSingletonQueryString(queryParams, name) {
  const value = queryParams[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw createHttpError(400, `${name} must be a single string`);
  }
  return value;
}

function parsePositiveInt(value, label, statusCode = 400) {
  if (!/^[1-9]\d*$/.test(String(value ?? ""))) {
    throw createHttpError(statusCode, `${label} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw createHttpError(statusCode, `${label} must be a positive integer`);
  }
  return parsed;
}

function parseWarningDays(queryParams) {
  const raw = readSingletonQueryString(queryParams, "days");
  if (raw === undefined) return DEFAULT_EXPIRY_WINDOW_DAYS;
  if (!/^\d+$/.test(raw)) {
    throw createHttpError(400, "days must be a whole number from 0 to 3650");
  }
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days > MAX_EXPIRY_WINDOW_DAYS) {
    throw createHttpError(400, "days must be a whole number from 0 to 3650");
  }
  return days;
}

function parseDateOnly(value, label, { required = false } = {}) {
  if (value === undefined) {
    if (required) throw createHttpError(400, `${label} is required`);
    return undefined;
  }
  if (value === null || value === "") {
    if (required) throw createHttpError(400, `${label} is required`);
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, `${label} must use YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw createHttpError(400, `${label} must be a valid calendar date`);
  }
  return value;
}

function parseBatchNumber(value, { required = false } = {}) {
  if (value === undefined) {
    if (required) throw createHttpError(400, "batch_number is required");
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw createHttpError(400, "batch_number must be a non-empty string");
  }
  const batchNumber = value.trim();
  if (batchNumber.length > 100) {
    throw createHttpError(400, "batch_number must be 100 characters or fewer");
  }
  return batchNumber;
}

function parseNotes(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw createHttpError(400, "notes must be a string");
  }
  const notes = value.trim();
  if (notes.length > 1000) {
    throw createHttpError(400, "notes must be 1000 characters or fewer");
  }
  return notes || null;
}

function resolveBusinessScope(req, requestedBusinessId) {
  const businessId = getActiveMembership(req, ["wholesaler"]).business_id;
  if (requestedBusinessId !== undefined && requestedBusinessId !== businessId) {
    throw createHttpError(403, "You do not have access to the requested business");
  }
  return businessId;
}

async function assertProductAccess(req, productId, { requireActive = false } = {}) {
  const { rows } = await query(
    `SELECT product_id, business_id, is_active
       FROM products
      WHERE product_id = $1`,
    [productId],
  );
  if (!rows.length || (requireActive && !rows[0].is_active)) {
    throw createHttpError(404, `Product ${productId} not found`);
  }

  const businessId = getActiveMembership(req, ["wholesaler"]).business_id;
  if (rows[0].business_id !== businessId) {
    throw createHttpError(403, "You do not own this product");
  }
  return rows[0];
}

async function loadOwnedBatch(req, rawBatchId) {
  const batchId = parsePositiveInt(rawBatchId, "batch id", 404);
  const { rows } = await query(
    `SELECT ib.*, p.business_id
       FROM inventory_batches ib
       JOIN products p ON p.product_id = ib.product_id
      WHERE ib.batch_id = $1`,
    [batchId],
  );
  if (!rows.length) {
    throw createHttpError(404, `Inventory batch ${rawBatchId} not found`);
  }

  const businessId = getActiveMembership(req, ["wholesaler"]).business_id;
  if (rows[0].business_id !== businessId) {
    throw createHttpError(403, "You do not own this inventory batch");
  }
  return rows[0];
}

function batchSelect(daysPlaceholder = "$1") {
  return `SELECT ib.batch_id,
                 ib.product_id,
                 p.business_id,
                 b.business_name,
                 p.product_name,
                 p.sku,
                 ib.batch_number,
                 ib.manufactured_on::text,
                 ib.received_on::text,
                 ib.expires_on::text,
                 ib.depleted_at,
                 ib.notes,
                 ib.created_at,
                 ib.updated_at,
                 (ib.expires_on - ${TODAY})::int AS days_until_expiry,
                 CASE
                   WHEN ib.depleted_at IS NOT NULL THEN 'depleted'
                   WHEN ib.expires_on < ${TODAY} THEN 'expired'
                   WHEN ib.expires_on <= ${TODAY} + ${daysPlaceholder}::integer THEN 'expiring_soon'
                   ELSE 'fresh'
                 END AS expiry_status
            FROM inventory_batches ib
            JOIN products p ON p.product_id = ib.product_id
            JOIN businesses b ON b.business_id = p.business_id`;
}

async function findBatch(batchId, warningDays = DEFAULT_EXPIRY_WINDOW_DAYS) {
  const { rows } = await query(
    `${batchSelect("$1")} WHERE ib.batch_id = $2`,
    [warningDays, batchId],
  );
  return rows[0] ?? null;
}

// List expiry records of the active wholesaler business. business_id is
// optional and must name that same business.
router.get(
  "/inventory-batches",
  requireAuth,
  requireAnyRole(MANAGER_ROLES),
  async (req, res, next) => {
    try {
      const { page, limit, offset, q } = parsePaginationQuery(req.query);
      const warningDays = parseWarningDays(req.query);
      const params = [warningDays];
      // Keep $1 present in both the count and row queries even when no status
      // filter uses the warning window; later filters can then share one stable
      // parameter list without renumbering placeholders.
      const conditions = ["$1::integer >= 0"];

      const rawBusinessId = readSingletonQueryString(req.query, "business_id");
      const requestedBusinessId = rawBusinessId === undefined
        ? undefined
        : parsePositiveInt(rawBusinessId, "business_id");
      const businessId = resolveBusinessScope(req, requestedBusinessId);
      params.push(businessId);
      conditions.push(`p.business_id = $${params.length}`);

      const rawProductId = readSingletonQueryString(req.query, "product_id");
      if (rawProductId !== undefined) {
        params.push(parsePositiveInt(rawProductId, "product_id"));
        conditions.push(`ib.product_id = $${params.length}`);
      }

      const status = readSingletonQueryString(req.query, "status");
      const statusConditions = {
        depleted: "ib.depleted_at IS NOT NULL",
        expired: `ib.depleted_at IS NULL AND ib.expires_on < ${TODAY}`,
        expiring_soon: `ib.depleted_at IS NULL
          AND ib.expires_on BETWEEN ${TODAY} AND ${TODAY} + $1::integer`,
        fresh: `ib.depleted_at IS NULL
          AND ib.expires_on > ${TODAY} + $1::integer`,
      };
      if (status !== undefined) {
        if (!Object.hasOwn(statusConditions, status)) {
          throw createHttpError(400, "status must be depleted, expired, expiring_soon, or fresh");
        }
        conditions.push(statusConditions[status]);
      }

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(
          ib.batch_number ILIKE $${params.length}
          OR p.product_name ILIKE $${params.length}
          OR p.sku ILIKE $${params.length}
        )`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const countResult = await query(
        `SELECT COUNT(*)::int AS total_items
           FROM inventory_batches ib
           JOIN products p ON p.product_id = ib.product_id
           ${where}`,
        params,
      );
      const { rows } = await query(
        `${batchSelect("$1")} ${where}
         ORDER BY (ib.depleted_at IS NOT NULL), ib.expires_on ASC, ib.batch_id ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      res.json({
        ...buildPaginatedResponse(rows, { page, limit }, countResult.rows[0].total_items),
        expiry_window_days: warningDays,
      });
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.post(
  "/inventory-batches",
  requireAuth,
  requireAnyRole(MANAGER_ROLES),
  async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const warningDays = parseWarningDays(req.query);
      const productId = parsePositiveInt(body.product_id, "product_id");
      await assertProductAccess(req, productId, { requireActive: true });

      const batchNumber = parseBatchNumber(body.batch_number, { required: true });
      const manufacturedOn = parseDateOnly(body.manufactured_on, "manufactured_on");
      const receivedOn = parseDateOnly(body.received_on, "received_on");
      const expiresOn = parseDateOnly(body.expires_on, "expires_on", { required: true });
      const notes = parseNotes(body.notes);
      if (manufacturedOn && manufacturedOn > expiresOn) {
        throw createHttpError(400, "manufactured_on cannot be after expires_on");
      }

      const { rows } = await query(
        `INSERT INTO inventory_batches
           (product_id, batch_number, manufactured_on, received_on, expires_on, notes)
         VALUES ($1, $2, $3, COALESCE($4::date, ${TODAY}), $5, $6)
         RETURNING batch_id`,
        [productId, batchNumber, manufacturedOn ?? null, receivedOn ?? null, expiresOn, notes ?? null],
      );
      const created = await findBatch(rows[0].batch_id, warningDays);
      res.status(201).json(created);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.patch(
  "/inventory-batches/:id",
  requireAuth,
  requireAnyRole(MANAGER_ROLES),
  async (req, res, next) => {
    try {
      const existing = await loadOwnedBatch(req, req.params.id);
      const warningDays = parseWarningDays(req.query);
      const body = req.body ?? {};
      if ("product_id" in body) {
        throw createHttpError(400, "product_id cannot be changed");
      }

      const updates = [];
      const params = [];
      const addUpdate = (column, value, cast = "") => {
        params.push(value);
        updates.push(`${column} = $${params.length}${cast}`);
      };

      const batchNumber = parseBatchNumber(body.batch_number);
      if (batchNumber !== undefined) addUpdate("batch_number", batchNumber);

      const manufacturedOn = parseDateOnly(body.manufactured_on, "manufactured_on");
      if (manufacturedOn !== undefined) addUpdate("manufactured_on", manufacturedOn, "::date");

      const receivedOn = parseDateOnly(body.received_on, "received_on");
      if (receivedOn !== undefined) {
        if (receivedOn === null) throw createHttpError(400, "received_on cannot be null");
        addUpdate("received_on", receivedOn, "::date");
      }

      const expiresOn = parseDateOnly(body.expires_on, "expires_on");
      if (expiresOn !== undefined) {
        if (expiresOn === null) throw createHttpError(400, "expires_on cannot be null");
        addUpdate("expires_on", expiresOn, "::date");
      }

      // PostgreSQL validates the effective date pair atomically, including
      // concurrent partial updates. Do not round-trip DATE through JS Date.

      const notes = parseNotes(body.notes);
      if (notes !== undefined) addUpdate("notes", notes);

      if ("depleted" in body) {
        if (typeof body.depleted !== "boolean") {
          throw createHttpError(400, "depleted must be a boolean");
        }
        updates.push(body.depleted
          ? "depleted_at = COALESCE(depleted_at, CURRENT_TIMESTAMP)"
          : "depleted_at = NULL");
      }

      if (!updates.length) {
        throw createHttpError(400, "No supported inventory batch fields were provided");
      }
      params.push(existing.batch_id);
      await query(
        `UPDATE inventory_batches
            SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
          WHERE batch_id = $${params.length}`,
        params,
      );
      res.json(await findBatch(existing.batch_id, warningDays));
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.delete(
  "/inventory-batches/:id",
  requireAuth,
  requireAnyRole(MANAGER_ROLES),
  async (req, res, next) => {
    try {
      const existing = await loadOwnedBatch(req, req.params.id);
      await query("DELETE FROM inventory_batches WHERE batch_id = $1", [existing.batch_id]);
      res.status(204).end();
    } catch (error) {
      next(asClientError(error));
    }
  },
);

export default router;
