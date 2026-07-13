import { Router } from "express";
import { query } from "../db.js";
import { requireAnyRole } from "../middleware/auth.js";
import {
  createHttpError,
  isPlatformAdmin,
  memberBusinessIds,
} from "../middleware/ownership.js";

const router = Router();

// Milestone 5: real GET /api/inventory, scoped to the caller's businesses
// (inventory_items -> warehouses -> business). Sprint 10: POST/PATCH writes
// per docs/API_CONTRACTS.md sections 1.2/1.3, same ownership scope enforced
// server-side. Out-of-scope warehouses/items answer 404, never 403, so
// callers cannot probe which ids exist (logistics anti-leak convention).
//
// warehouses has no city column; the contract's warehouse.city comes from the
// warehouse's address (addresses.city_municipality). status is derived from
// quantity vs reorder_threshold, never stored.
const INVENTORY_SELECT = `
  SELECT ii.item_id,
         json_build_object(
           'product_id', p.product_id,
           'product_name', p.product_name,
           'sku', p.sku,
           'category', CASE WHEN c.category_id IS NULL THEN NULL ELSE
             json_build_object('category_id', c.category_id, 'category_name', c.category_name)
           END,
           'description', p.description
         ) AS product,
         json_build_object(
           'warehouse_id', w.warehouse_id,
           'warehouse_name', w.warehouse_name,
           'city', a.city_municipality
         ) AS warehouse,
         ii.quantity,
         ii.unit,
         ii.reorder_threshold,
         CASE
           WHEN ii.quantity = 0 THEN 'Out of Stock'
           WHEN ii.quantity <= ii.reorder_threshold THEN 'Low Stock'
           ELSE 'In Stock'
         END AS status,
         ii.created_at
    FROM inventory_items ii
    JOIN products p    ON p.product_id = ii.product_id
    JOIN warehouses w  ON w.warehouse_id = ii.warehouse_id
    JOIN addresses a   ON a.address_id = w.address_id
    LEFT JOIN categories c ON c.category_id = p.category_id`;

router.get("/", async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];

    // Admins see all inventory; everyone else is scoped to their own
    // businesses (the warehouse's owning business).
    if (!isPlatformAdmin(req.auth.user)) {
      params.push(memberBusinessIds(req));
      conditions.push(`w.business_id = ANY($${params.length}::int[])`);
    }

    if (req.query.warehouse_id !== undefined) {
      params.push(Number(req.query.warehouse_id));
      conditions.push(`w.warehouse_id = $${params.length}`);
    }
    if (req.query.category_id !== undefined) {
      params.push(Number(req.query.category_id));
      conditions.push(`p.category_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await query(
      `${INVENTORY_SELECT} ${where} ORDER BY ii.item_id`,
      params,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// PostgreSQL constraint violations mean the client sent a bad reference or
// value (unknown product, duplicate product+warehouse pair, negative CHECK),
// not that the server broke. Map to 400 -- same pattern as products.js.
// 23503 FK, 23514 CHECK, 23505 UNIQUE.
function asClientError(error) {
  if (["23503", "23514", "23505"].includes(error.code)) {
    error.statusCode = 400;
  }
  return error;
}

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// The flat write-response shape from API_CONTRACTS 1.2/1.3 (no joins).
const ITEM_RETURNING =
  "RETURNING item_id, product_id, warehouse_id, quantity, unit, reorder_threshold, created_at";

function validateQuantity(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw createHttpError(400, "quantity must be an integer greater than or equal to 0");
  }
  return n;
}

function validateReorderThreshold(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw createHttpError(400, "reorder_threshold must be an integer greater than or equal to 0");
  }
  return n;
}

function validateUnit(value) {
  if (typeof value !== "string" || value.trim() === "" || value.length > 20) {
    throw createHttpError(400, "unit must be a non-empty string of 20 characters or fewer");
  }
  return value.trim();
}

// 404 (not 403) when the warehouse doesn't exist OR isn't the caller's.
async function loadOwnedWarehouse(req, warehouseId) {
  const id = parsePositiveInt(warehouseId);
  if (id === null) {
    throw createHttpError(404, `Warehouse ${warehouseId} not found`);
  }
  const { rows } = await query(
    "SELECT warehouse_id, business_id FROM warehouses WHERE warehouse_id = $1",
    [id],
  );
  const warehouse = rows[0];
  const owns =
    warehouse &&
    (isPlatformAdmin(req.auth.user) ||
      memberBusinessIds(req).includes(warehouse.business_id));
  if (!owns) {
    throw createHttpError(404, `Warehouse ${warehouseId} not found`);
  }
  return warehouse;
}

router.post(
  "/",
  requireAnyRole(["wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const { product_id, warehouse_id, quantity, unit, reorder_threshold } =
        req.body ?? {};

      const productId = parsePositiveInt(product_id);
      if (productId === null) {
        throw createHttpError(400, "product_id is required and must be a positive integer");
      }
      await loadOwnedWarehouse(req, warehouse_id);
      const qty = validateQuantity(quantity);
      // unit / reorder_threshold are optional; fall back to the schema defaults.
      const unitValue = unit === undefined || unit === null ? "pcs" : validateUnit(unit);
      const threshold =
        reorder_threshold === undefined || reorder_threshold === null
          ? 10
          : validateReorderThreshold(reorder_threshold);

      const { rows } = await query(
        `INSERT INTO inventory_items (product_id, warehouse_id, quantity, unit, reorder_threshold)
         VALUES ($1, $2, $3, $4, $5)
         ${ITEM_RETURNING}`,
        [productId, Number(warehouse_id), qty, unitValue, threshold],
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.patch(
  "/:id",
  requireAnyRole(["wholesaler", "platform_admin"]),
  async (req, res, next) => {
    try {
      const itemId = parsePositiveInt(req.params.id);
      if (itemId === null) {
        throw createHttpError(404, `Inventory item ${req.params.id} not found`);
      }

      // Ownership travels item -> warehouse -> business; out of scope is 404.
      const { rows } = await query(
        `SELECT ii.item_id, w.business_id
           FROM inventory_items ii
           JOIN warehouses w ON w.warehouse_id = ii.warehouse_id
          WHERE ii.item_id = $1`,
        [itemId],
      );
      const item = rows[0];
      const owns =
        item &&
        (isPlatformAdmin(req.auth.user) ||
          memberBusinessIds(req).includes(item.business_id));
      if (!owns) {
        throw createHttpError(404, `Inventory item ${req.params.id} not found`);
      }

      const body = req.body ?? {};
      const updates = [];
      const params = [];

      if ("quantity" in body) {
        params.push(validateQuantity(body.quantity));
        updates.push(`quantity = $${params.length}`);
      }
      if ("reorder_threshold" in body) {
        params.push(validateReorderThreshold(body.reorder_threshold));
        updates.push(`reorder_threshold = $${params.length}`);
      }
      if ("unit" in body) {
        params.push(validateUnit(body.unit));
        updates.push(`unit = $${params.length}`);
      }
      if (!updates.length) {
        throw createHttpError(400, "Provide at least one of quantity, reorder_threshold, unit");
      }

      params.push(itemId);
      const updated = await query(
        `UPDATE inventory_items SET ${updates.join(", ")}
          WHERE item_id = $${params.length}
          ${ITEM_RETURNING}`,
        params,
      );
      res.json(updated.rows[0]);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

export default router;
