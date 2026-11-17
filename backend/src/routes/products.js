import { Router } from "express";
import { query } from "../db.js";
import { MARKETPLACE_ROLES, requireAnyRole, requireAuth } from "../middleware/auth.js";
import { activeMemberships } from "../middleware/ownership.js";
import { buildPaginatedResponse, parsePaginationQuery } from "../services/pagination.js";

const router = Router();

// Milestone 2: database-backed marketplace products + the category taxonomy.
// Shapes documented in docs/API_CONTRACTS.md.

// PostgreSQL constraint violations mean the client sent a bad reference or
// value (unknown category, duplicate sku), not that the server broke. Map to
// 400 -- same pattern as logistics.js. 23503 FK, 23514 CHECK, 23505 UNIQUE.
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

function parseNonNegativePrice(query, name) {
  const value = readSingletonQueryString(query, name);
  if (value === undefined) return undefined;
  if (value.trim() === "") {
    throw createHttpError(400, `${name} must be a non-negative number`);
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    throw createHttpError(400, `${name} must be a non-negative number`);
  }
  return price;
}

// product_id is a positive-integer SERIAL. Reject anything else up front so a
// non-numeric :id becomes a clean 404 instead of a 22P02 invalid-input 500.
function parseProductId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(404, `Product ${rawId} not found`);
  }
  return id;
}

// stock_status is derived, never stored: 0 -> out_of_stock, 1..10 -> low_stock,
// >10 -> in_stock. Computed in SQL so every product row carries it.
const PRODUCT_SELECT = `
  SELECT p.product_id,
         p.business_id,
         b.business_name,
         p.product_name,
         p.sku,
         p.description,
         p.category_id,
         c.category_name,
         p.unit_price::text AS unit_price,
         p.stock_quantity,
         CASE
           WHEN p.stock_quantity = 0 THEN 'out_of_stock'
           WHEN p.stock_quantity <= 10 THEN 'low_stock'
           ELSE 'in_stock'
         END AS stock_status,
         p.image_url,
         p.is_active,
         p.removed_by,
         p.removal_reason,
         p.removed_at,
         p.created_at
    FROM products p
    JOIN businesses b ON b.business_id = p.business_id
    LEFT JOIN categories c ON c.category_id = p.category_id`;

// Removed products remain visible only to their owning wholesaler.
function ownerBusinessId(req) {
  return activeMemberships(req).find((m) => m.role === "wholesaler")?.business_id ?? null;
}

// Load one visible product by id in the full shape, or null.
async function findProduct(productId, businessId = null) {
  const { rows } = await query(
    `${PRODUCT_SELECT} WHERE p.product_id = $1 AND (p.is_active = TRUE OR (p.removed_at IS NOT NULL AND p.business_id = $2))`,
    [productId, businessId],
  );
  return rows[0] ?? null;
}

// The wholesaler business the caller owns products under. Returns:
//   businessId (number)         -> the active business, when it is a wholesaler
//   throws 403                  -> active business is not a wholesaler
//                                  (always for platform_admin: it holds no memberships)
//   throws 400                  -> multiple businesses and no X-Active-Business
// Wholesaler roles on other (unselected) businesses grant nothing.
function resolveWholesalerBusiness(req) {
  const active = activeMemberships(req).find((m) => m.role === "wholesaler");
  if (active) {
    return active.business_id;
  }
  throw createHttpError(403, "You must belong to a wholesaler business to manage products");
}

// ---------------------------------------------------------------------------
// Catalog reads (categories, products) -- buyers and wholesalers only. Admins
// moderate through /api/admin; logistics roles have no marketplace duties.
// ---------------------------------------------------------------------------
router.get("/categories", requireAuth, requireAnyRole(MARKETPLACE_ROLES), async (_req, res) => {
  const { rows } = await query(
    `SELECT c.category_id,
            c.category_name,
            (SELECT COUNT(*)::int FROM products p
              WHERE p.category_id = c.category_id AND p.is_active = TRUE) AS product_count
       FROM categories c
      ORDER BY c.category_name`,
  );
  res.json(rows);
});

// Lightweight category choices for forms. Unlike /categories, this omits
// product counts and deliberately remains a bounded array.
router.get("/categories/options", requireAuth, requireAnyRole(MARKETPLACE_ROLES), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT category_id, category_name
         FROM categories
        ORDER BY category_name ASC, category_id ASC`,
    );
    res.json(rows);
  } catch (error) {
    next(asClientError(error));
  }
});

// ---------------------------------------------------------------------------
// Product reads include removed rows only for their active-business owner.
// ---------------------------------------------------------------------------
router.get("/products", requireAuth, requireAnyRole(MARKETPLACE_ROLES), async (req, res, next) => {
  try {
    const { page, limit, offset, q } = parsePaginationQuery(req.query);
    const ownerId = ownerBusinessId(req);
    const conditions = ["(p.is_active = TRUE OR (p.removed_at IS NOT NULL AND p.business_id = $1))"];
    const params = [ownerId];

    const businessId = parsePositiveQueryId(req.query, "business_id");
    if (businessId !== undefined) {
      params.push(businessId);
      conditions.push(`p.business_id = $${params.length}`);
    }
    const categoryId = parsePositiveQueryId(req.query, "category_id");
    if (categoryId !== undefined) {
      params.push(categoryId);
      conditions.push(`p.category_id = $${params.length}`);
    }
    const minPrice = parseNonNegativePrice(req.query, "min_price");
    const maxPrice = parseNonNegativePrice(req.query, "max_price");
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw createHttpError(400, "min_price must be less than or equal to max_price");
    }
    if (minPrice !== undefined) {
      params.push(minPrice);
      conditions.push(`p.unit_price >= $${params.length}`);
    }
    if (maxPrice !== undefined) {
      params.push(maxPrice);
      conditions.push(`p.unit_price <= $${params.length}`);
    }
    const stockStatus = readSingletonQueryString(req.query, "stock_status");
    const stockConditions = {
      out_of_stock: "p.stock_quantity = 0",
      low_stock: "p.stock_quantity BETWEEN 1 AND 10",
      in_stock: "p.stock_quantity > 10",
    };
    if (stockStatus !== undefined) {
      if (!Object.hasOwn(stockConditions, stockStatus)) {
        throw createHttpError(400, "stock_status must be out_of_stock, low_stock, or in_stock");
      }
      conditions.push(stockConditions[stockStatus]);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(
        p.product_name ILIKE $${params.length}
        OR p.sku ILIKE $${params.length}
        OR c.category_name ILIKE $${params.length}
      )`);
    }

    // Closed allowlist, so interpolating orderBy into the SQL below is safe.
    // Mirrors the sort handling on GET /api/suppliers.
    const sort = readSingletonQueryString(req.query, "sort") ?? "name";
    if (!new Set(["name", "featured"]).has(sort)) {
      throw createHttpError(400, "sort must be name or featured");
    }
    // Verified wholesalers first, then freshest catalog. product_id ASC is the
    // deterministic tiebreaker that keeps pagination stable across pages.
    const orderBy = sort === "featured"
      ? "b.is_verified DESC, p.created_at DESC, p.product_name ASC, p.product_id ASC"
      : "p.product_name ASC, p.product_id ASC";

    const where = `WHERE ${conditions.join(" AND ")}`;
    const countResult = await query(
      `SELECT COUNT(*)::int AS total_items
         FROM products p
         LEFT JOIN categories c ON c.category_id = p.category_id
         ${where}`,
      params,
    );

    const { rows } = await query(
      `${PRODUCT_SELECT} ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    res.json(buildPaginatedResponse(rows, { page, limit }, countResult.rows[0].total_items));
  } catch (error) {
    next(asClientError(error));
  }
});

router.get("/products/:id", requireAuth, requireAnyRole(MARKETPLACE_ROLES), async (req, res, next) => {
  try {
    const productId = parseProductId(req.params.id);
    const product = await findProduct(productId, ownerBusinessId(req));
    if (!product) {
      throw createHttpError(404, `Product ${req.params.id} not found`);
    }
    res.json(product);
  } catch (error) {
    next(asClientError(error));
  }
});

// ---------------------------------------------------------------------------
// Create -- wholesaler only (platform_admin is never a seller).
// ---------------------------------------------------------------------------
router.post(
  "/products",
  requireAuth,
  requireAnyRole(["wholesaler"]),
  async (req, res, next) => {
    try {
      const {
        product_name,
        unit_price,
        sku,
        description,
        category_id,
        stock_quantity,
        image_url,
      } = req.body ?? {};

      // ---- Field validation (owner comes from the active business, never the body) ----
      if (typeof product_name !== "string" || product_name.trim() === "") {
        throw createHttpError(400, "product_name is required");
      }
      if (product_name.length > 100) {
        throw createHttpError(400, "product_name must be 100 characters or fewer");
      }
      const price = Number(unit_price);
      if (unit_price === undefined || unit_price === null || Number.isNaN(price) || price < 0) {
        throw createHttpError(400, "unit_price is required and must be a number greater than or equal to 0");
      }
      if (sku !== undefined && sku !== null && String(sku).length > 50) {
        throw createHttpError(400, "sku must be 50 characters or fewer");
      }
      let stock = 0;
      if (stock_quantity !== undefined && stock_quantity !== null) {
        stock = Number(stock_quantity);
        if (!Number.isInteger(stock) || stock < 0) {
          throw createHttpError(400, "stock_quantity must be an integer greater than or equal to 0");
        }
      }

      // ---- Resolve the owning business ----
      const businessId = resolveWholesalerBusiness(req);

      const insert = await query(
        `INSERT INTO products
           (business_id, product_name, sku, description, category_id, unit_price, stock_quantity, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING product_id`,
        [
          businessId,
          product_name.trim(),
          sku ?? null,
          description ?? null,
          category_id ?? null,
          price,
          stock,
          image_url ?? null,
        ],
      );

      const created = await findProduct(insert.rows[0].product_id);
      res.status(201).json(created);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

// Shared ownership guard for product mutations.
async function loadOwnedProduct(req) {
  const productId = parseProductId(req.params.id);
  const { rows } = await query(
    `SELECT product_id, business_id FROM products
      WHERE product_id = $1 AND (is_active = TRUE OR removed_at IS NOT NULL)`,
    [productId],
  );
  if (!rows.length) {
    throw createHttpError(404, `Product ${req.params.id} not found`);
  }

  const owns = activeMemberships(req).some(
    (m) => m.role === "wholesaler" && m.business_id === rows[0].business_id,
  );
  if (!owns) {
    throw createHttpError(403, "You do not own this product");
  }
  return rows[0];
}

// ---------------------------------------------------------------------------
// Update -- wholesaler (own product only). Partial.
// ---------------------------------------------------------------------------
router.patch(
  "/products/:id",
  requireAuth,
  requireAnyRole(["wholesaler"]),
  async (req, res, next) => {
    try {
      await loadOwnedProduct(req);

      const body = req.body ?? {};
      const updates = [];
      const params = [];

      if ("product_name" in body) {
        if (typeof body.product_name !== "string" || body.product_name.trim() === "") {
          throw createHttpError(400, "product_name must be a non-empty string");
        }
        if (body.product_name.length > 100) {
          throw createHttpError(400, "product_name must be 100 characters or fewer");
        }
        params.push(body.product_name.trim());
        updates.push(`product_name = $${params.length}`);
      }
      if ("unit_price" in body) {
        const price = Number(body.unit_price);
        if (Number.isNaN(price) || price < 0) {
          throw createHttpError(400, "unit_price must be a number greater than or equal to 0");
        }
        params.push(price);
        updates.push(`unit_price = $${params.length}`);
      }
      if ("sku" in body) {
        if (body.sku !== null && String(body.sku).length > 50) {
          throw createHttpError(400, "sku must be 50 characters or fewer");
        }
        params.push(body.sku ?? null);
        updates.push(`sku = $${params.length}`);
      }
      if ("description" in body) {
        params.push(body.description ?? null);
        updates.push(`description = $${params.length}`);
      }
      if ("category_id" in body) {
        params.push(body.category_id ?? null);
        updates.push(`category_id = $${params.length}`);
      }
      if ("stock_quantity" in body) {
        const stock = Number(body.stock_quantity);
        if (!Number.isInteger(stock) || stock < 0) {
          throw createHttpError(400, "stock_quantity must be an integer greater than or equal to 0");
        }
        params.push(stock);
        updates.push(`stock_quantity = $${params.length}`);
      }
      if ("image_url" in body) {
        params.push(body.image_url ?? null);
        updates.push(`image_url = $${params.length}`);
      }

      if (updates.length) {
        params.push(req.params.id);
        await query(
          `UPDATE products SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $${params.length}`,
          params,
        );
      }

      const updated = await findProduct(req.params.id, ownerBusinessId(req));
      res.json(updated);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

// ---------------------------------------------------------------------------
// Delete -- final owner deletion, including a currently removed product.
// ---------------------------------------------------------------------------
router.delete(
  "/products/:id",
  requireAuth,
  requireAnyRole(["wholesaler"]),
  async (req, res, next) => {
    try {
      await loadOwnedProduct(req);
      await query(
        `UPDATE products SET is_active = FALSE, removed_at = NULL WHERE product_id = $1`,
        [req.params.id],
      );
      res.status(204).end();
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.post("/products/:id/relist", requireAuth, requireAnyRole(["wholesaler"]), async (req, res, next) => {
  try {
    const product = await loadOwnedProduct(req);
    const result = await query(
      `UPDATE products SET is_active = TRUE, removed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $1 AND business_id = $2 AND removed_at IS NOT NULL
        RETURNING product_id`,
      [product.product_id, product.business_id],
    );
    if (!result.rowCount) throw createHttpError(409, "Only currently removed products can be relisted");
    res.json(await findProduct(product.product_id));
  } catch (error) {
    if (error.code === "23505") {
      next(createHttpError(409, "Another active product uses this SKU. Change the SKU before relisting."));
    } else {
      next(asClientError(error));
    }
  }
});

export default router;
