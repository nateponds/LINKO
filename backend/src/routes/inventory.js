import { Router } from "express";
import { query } from "../db.js";
import { isPlatformAdmin, memberBusinessIds } from "../middleware/ownership.js";

const router = Router();

// Milestone 5: real GET /api/inventory. Scoped to the caller's businesses
// (inventory_items -> warehouses -> business). Shape per docs/API_CONTRACTS.md
// section 1.1. POST/PATCH remain 501 stubs until a later milestone.
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

router.post("/", (_req, res) => {
  res.status(501).json({
    error: { message: "Inventory creation is not implemented yet" },
  });
});

router.patch("/:id", (req, res) => {
  res.status(501).json({
    error: {
      message: `Inventory item ${req.params.id} updates are not implemented yet`,
    },
  });
});

export default router;
