import { Router } from "express";
import { query } from "../db.js";
import { buildPaginatedResponse, parsePaginationQuery } from "../services/pagination.js";

const router = Router();

// Milestone 2: real supplier listing -- businesses acting as wholesalers, with
// a count of their active products. Auth is enforced at the mount (any
// authenticated user). Shape documented in docs/API_CONTRACTS.md.

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

function readSingletonQueryString(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw createHttpError(400, `${name} must be a single string`);
  }
  return value;
}

function parsePositiveQueryId(query, name) {
  const value = readSingletonQueryString(query, name);
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) {
    throw createHttpError(400, `${name} must be a positive integer`);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw createHttpError(400, `${name} must be a positive integer`);
  }
  return id;
}

function parseSupplierId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(404, `Supplier ${rawId} not found`);
  }
  return id;
}

router.get("/", async (req, res, next) => {
  try {
    const { page, limit, offset, q } = parsePaginationQuery(req.query);
    const conditions = ["b.business_type = 'wholesaler'"];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        b.business_name ILIKE $${params.length}
        OR EXISTS (
          SELECT 1 FROM addresses search_a
           WHERE search_a.business_id = b.business_id
             AND (search_a.province ILIKE $${params.length} OR search_a.city_municipality ILIKE $${params.length})
        )
      )`);
    }
    const categoryId = parsePositiveQueryId(req.query, "category_id");
    if (categoryId !== undefined) {
      params.push(categoryId);
      conditions.push(`EXISTS (
        SELECT 1 FROM products p
         WHERE p.business_id = b.business_id
           AND p.is_active = TRUE
           AND p.category_id = $${params.length}
      )`);
    }
    const sort = readSingletonQueryString(req.query, "sort") ?? "name";
    if (!new Set(["name", "featured"]).has(sort)) {
      throw createHttpError(400, "sort must be name or featured");
    }
    const orderBy = sort === "featured"
      ? "b.is_verified DESC, product_count DESC, b.business_name ASC, b.business_id ASC"
      : "b.business_name ASC, b.business_id ASC";
    const where = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total_items FROM businesses b ${where}`,
      params,
    );

    const { rows } = await query(
      `SELECT b.business_id,
              b.business_name,
              a.province,
              a.city_municipality,
              a.street_address,
              b.is_verified,
              (SELECT COUNT(*)::int FROM products p
                WHERE p.business_id = b.business_id AND p.is_active = TRUE) AS product_count
         FROM businesses b
         LEFT JOIN LATERAL (
           SELECT province, city_municipality, street_address
             FROM addresses
            WHERE business_id = b.business_id
            ORDER BY address_id ASC
            LIMIT 1
         ) a ON TRUE
        ${where}
        ORDER BY ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    res.json(buildPaginatedResponse(rows, { page, limit }, countResult.rows[0].total_items));
  } catch (error) {
    next(asClientError(error));
  }
});

// Supplier detail keeps the marketplace listing summary and adds the number of
// active categories represented by its current catalog.
router.get("/:id", async (req, res, next) => {
  try {
    const supplierId = parseSupplierId(req.params.id);
    const { rows } = await query(
      `SELECT b.business_id,
              b.business_name,
              a.province,
              a.city_municipality,
              a.street_address,
              b.is_verified,
              (SELECT COUNT(*)::int FROM products p
                WHERE p.business_id = b.business_id AND p.is_active = TRUE) AS product_count,
              (SELECT COUNT(DISTINCT p.category_id)::int FROM products p
                WHERE p.business_id = b.business_id
                  AND p.is_active = TRUE
                  AND p.category_id IS NOT NULL) AS category_count
         FROM businesses b
         LEFT JOIN LATERAL (
           SELECT province, city_municipality, street_address
             FROM addresses
            WHERE business_id = b.business_id
            ORDER BY address_id ASC
            LIMIT 1
         ) a ON TRUE
        WHERE b.business_id = $1 AND b.business_type = 'wholesaler'`,
      [supplierId],
    );
    if (!rows.length) {
      throw createHttpError(404, `Supplier ${req.params.id} not found`);
    }
    res.json(rows[0]);
  } catch (error) {
    next(asClientError(error));
  }
});

router.get("/:id/categories", async (req, res, next) => {
  try {
    const supplierId = parseSupplierId(req.params.id);
    const { page, limit, offset, q } = parsePaginationQuery(req.query);

    const exists = await query(
      "SELECT 1 FROM businesses WHERE business_id = $1 AND business_type = 'wholesaler'",
      [supplierId],
    );
    if (!exists.rows.length) {
      throw createHttpError(404, `Supplier ${req.params.id} not found`);
    }

    const params = [supplierId];
    const conditions = ["p.business_id = $1", "p.is_active = TRUE", "p.category_id IS NOT NULL"];
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`c.category_name ILIKE $${params.length}`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const categoriesCte = `
      WITH supplier_categories AS (
        SELECT c.category_id,
               c.category_name AS name,
               COUNT(*)::int AS product_count
          FROM products p
          JOIN categories c ON c.category_id = p.category_id
          ${where}
         GROUP BY c.category_id, c.category_name
      )`;
    const countResult = await query(
      `${categoriesCte} SELECT COUNT(*)::int AS total_items FROM supplier_categories`,
      params,
    );
    const { rows } = await query(
      `${categoriesCte}
       SELECT category_id, name, product_count
         FROM supplier_categories
        ORDER BY name ASC, category_id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    res.json(buildPaginatedResponse(rows, { page, limit }, countResult.rows[0].total_items));
  } catch (error) {
    next(asClientError(error));
  }
});

export default router;
