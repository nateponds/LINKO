import { Router } from "express";
import { query } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";

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
         p.created_at
    FROM products p
    JOIN businesses b ON b.business_id = p.business_id
    LEFT JOIN categories c ON c.category_id = p.category_id`;

// Load one active product by id in the full shape, or null.
async function findProduct(productId) {
  const { rows } = await query(
    `${PRODUCT_SELECT} WHERE p.product_id = $1 AND p.is_active = TRUE`,
    [productId],
  );
  return rows[0] ?? null;
}

// The wholesaler business the caller owns products under. Returns:
//   { businessId }              -> exactly one wholesaler membership
//   throws 403                  -> no wholesaler membership (and not admin)
//   throws 400                  -> more than one (unsupported yet)
// platform_admin with no wholesaler membership resolves to null so the caller
// can require an explicit business_id from the body instead.
function resolveWholesalerBusiness(auth) {
  const wholesalerMemberships = auth.memberships.filter(
    (m) => m.role === "wholesaler",
  );

  if (wholesalerMemberships.length === 1) {
    return wholesalerMemberships[0].business_id;
  }
  if (wholesalerMemberships.length > 1) {
    throw createHttpError(400, "multiple wholesaler businesses not supported yet");
  }
  if (auth.user.global_role === "platform_admin") {
    return null;
  }
  throw createHttpError(403, "You must belong to a wholesaler business to manage products");
}

const isAdmin = (auth) => auth.user.global_role === "platform_admin";

// ---------------------------------------------------------------------------
// Categories -- any authenticated user.
// ---------------------------------------------------------------------------
router.get("/categories", requireAuth, async (_req, res) => {
  const { rows } = await query(
    `SELECT category_id, category_name FROM categories ORDER BY category_name`,
  );
  res.json(rows);
});

// ---------------------------------------------------------------------------
// Product listing / detail -- any authenticated user, active products only.
// ---------------------------------------------------------------------------
router.get("/products", requireAuth, async (req, res, next) => {
  try {
    const conditions = ["p.is_active = TRUE"];
    const params = [];

    if (req.query.business_id !== undefined) {
      params.push(Number(req.query.business_id));
      conditions.push(`p.business_id = $${params.length}`);
    }
    if (req.query.category_id !== undefined) {
      params.push(Number(req.query.category_id));
      conditions.push(`p.category_id = $${params.length}`);
    }
    if (req.query.q !== undefined && req.query.q !== "") {
      params.push(`%${req.query.q}%`);
      conditions.push(`p.product_name ILIKE $${params.length}`);
    }

    const { rows } = await query(
      `${PRODUCT_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY p.product_name`,
      params,
    );
    res.json(rows);
  } catch (error) {
    next(asClientError(error));
  }
});

router.get("/products/:id", requireAuth, async (req, res, next) => {
  try {
    const productId = parseProductId(req.params.id);
    const product = await findProduct(productId);
    if (!product) {
      throw createHttpError(404, `Product ${req.params.id} not found`);
    }
    res.json(product);
  } catch (error) {
    next(asClientError(error));
  }
});

// ---------------------------------------------------------------------------
// Create -- wholesaler or platform_admin.
// ---------------------------------------------------------------------------
router.post(
  "/products",
  requireAuth,
  requireAnyRole(["wholesaler", "platform_admin"]),
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
        business_id: bodyBusinessId,
      } = req.body ?? {};

      // ---- Field validation (never trust body business_id except admin) ----
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
      const ownedBusinessId = resolveWholesalerBusiness(req.auth);
      let businessId = ownedBusinessId;

      if (ownedBusinessId === null) {
        // platform_admin with no wholesaler membership must name the business.
        if (bodyBusinessId === undefined || bodyBusinessId === null) {
          throw createHttpError(400, "business_id is required when creating as an administrator");
        }
        const { rows } = await query(
          `SELECT business_id FROM businesses
            WHERE business_id = $1 AND business_type IN ('wholesaler', 'both')`,
          [Number(bodyBusinessId)],
        );
        if (!rows.length) {
          throw createHttpError(400, "business_id must reference an existing wholesaler business");
        }
        businessId = rows[0].business_id;
      }

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

// Shared ownership guard for PATCH / DELETE: returns the target row (active) or
// throws 404; throws 403 unless caller owns the product's business or is admin.
async function loadOwnedProduct(req) {
  const productId = parseProductId(req.params.id);
  const { rows } = await query(
    `SELECT product_id, business_id FROM products
      WHERE product_id = $1 AND is_active = TRUE`,
    [productId],
  );
  if (!rows.length) {
    throw createHttpError(404, `Product ${req.params.id} not found`);
  }

  if (isAdmin(req.auth)) {
    return rows[0];
  }
  const owns = req.auth.memberships.some(
    (m) => m.role === "wholesaler" && m.business_id === rows[0].business_id,
  );
  if (!owns) {
    throw createHttpError(403, "You do not own this product");
  }
  return rows[0];
}

// ---------------------------------------------------------------------------
// Update -- wholesaler (own product) or platform_admin (any). Partial.
// ---------------------------------------------------------------------------
router.patch(
  "/products/:id",
  requireAuth,
  requireAnyRole(["wholesaler", "platform_admin"]),
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
          `UPDATE products SET ${updates.join(", ")} WHERE product_id = $${params.length}`,
          params,
        );
      }

      const updated = await findProduct(req.params.id);
      res.json(updated);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

// ---------------------------------------------------------------------------
// Delete -- soft delete (is_active = FALSE). Same auth/ownership as PATCH.
// ---------------------------------------------------------------------------
router.delete(
  "/products/:id",
  requireAuth,
  requireAnyRole(["wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      await loadOwnedProduct(req);
      await query(
        `UPDATE products SET is_active = FALSE WHERE product_id = $1`,
        [req.params.id],
      );
      res.status(204).end();
    } catch (error) {
      next(asClientError(error));
    }
  },
);

export default router;
