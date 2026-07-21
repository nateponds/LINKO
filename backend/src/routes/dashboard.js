import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function asClientError(error) {
  return error;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// GET /api/dashboard?range=today|7d|30d
// Returns stats for the active user's businesses, windowed to the range:
// revenue/orders/sales-trend/top-products cover the window; low-stock and
// product counts are current state. Bucket labels are formatted by Postgres
// so the API and the DB never disagree about bucket boundaries.
const RANGE_CONFIG = {
  today: { bucket: "hour", count: 24, labelFormat: "FMHH12 AM" },
  "7d": { bucket: "day", count: 7, labelFormat: "FMMon FMDD" },
  "30d": { bucket: "day", count: 30, labelFormat: "FMMon FMDD" },
};

router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const { memberships } = req.auth;

    // Wholesaler-only: the dashboard is a wholesaler's own sales workspace.
    // No platform_admin bypass here, unlike requireAnyRole.
    const isWholesaler = memberships.some(m => m.role === "wholesaler");
    if (!isWholesaler) {
      throw createHttpError(403, "Forbidden");
    }

    const businessIds = memberships.map(m => m.business_id);

    const { bucket, count, labelFormat } =
      RANGE_CONFIG[req.query.range] ?? RANGE_CONFIG["7d"];
    // bucket/count come from the fixed map above, never from user input,
    // so interpolating them into SQL is safe.
    const windowStart = `date_trunc('${bucket}', CURRENT_TIMESTAMP) - INTERVAL '${count - 1} ${bucket}'`;

    if (businessIds.length === 0) {
      return res.json({
        revenue: 0,
        orders: 0,
        lowStock: 0,
        products: 0,
        sales: [],
        topProducts: [],
        recentActivity: [],
      });
    }

    const orderScope =
      "(o.wholesaler_business_id = ANY($1::int[]) OR o.buyer_business_id = ANY($1::int[]))";
    const params = [businessIds];

    const revenueQuery = `SELECT COALESCE(SUM(i.total), 0) AS val
           FROM invoices i
           JOIN orders o ON o.order_id = i.order_id
          WHERE o.wholesaler_business_id = ANY($1::int[])
            AND i.issued_at >= ${windowStart}`;

    const ordersQuery = `
      SELECT COUNT(*) AS val
        FROM orders o
       WHERE ${orderScope} AND o.created_at >= ${windowStart}`;

    const lowStockQuery =
      "SELECT COUNT(*) AS val FROM products WHERE business_id = ANY($1::int[]) AND stock_quantity < 10";

    const productsQuery =
      "SELECT COUNT(*) AS val FROM products WHERE business_id = ANY($1::int[])";

    // Orders per bucket across the whole window; generate_series fills the
    // quiet buckets with zero so the chart never has gaps.
    const salesQuery = `
      SELECT to_char(gs.bucket, '${labelFormat}') AS label,
             COALESCE(counts.val, 0)::int AS value
        FROM generate_series(
               ${windowStart},
               date_trunc('${bucket}', CURRENT_TIMESTAMP),
               INTERVAL '1 ${bucket}'
             ) AS gs(bucket)
        LEFT JOIN (
          SELECT date_trunc('${bucket}', o.created_at) AS bucket, COUNT(*) AS val
            FROM orders o
           WHERE ${orderScope} AND o.created_at >= ${windowStart}
           GROUP BY 1
        ) counts ON counts.bucket = gs.bucket
       ORDER BY gs.bucket`;

    const topProductsQuery = `
      SELECT p.product_name AS name,
             p.sku,
             SUM(oi.quantity)::int AS sold,
             SUM(oi.quantity * oi.unit_price_snapshot) AS revenue
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        JOIN products p ON p.product_id = oi.product_id
       WHERE ${orderScope}
         AND o.status <> 'cancelled'
         AND o.created_at >= ${windowStart}
       GROUP BY p.product_id, p.product_name, p.sku
       ORDER BY sold DESC
       LIMIT 5`;

    const recentActivityQuery = `
      SELECT o.order_id,
             o.status,
             o.updated_at,
             bb.business_name AS buyer_business_name,
             wb.business_name AS wholesaler_business_name
        FROM orders o
        JOIN businesses bb ON bb.business_id = o.buyer_business_id
        JOIN businesses wb ON wb.business_id = o.wholesaler_business_id
       WHERE ${orderScope}
       ORDER BY o.updated_at DESC
       LIMIT 6`;

    const [revRes, ordRes, lowRes, prodRes, salesRes, topRes, activityRes] =
      await Promise.all([
        query(revenueQuery, params),
        query(ordersQuery, params),
        query(lowStockQuery, params),
        query(productsQuery, params),
        query(salesQuery, params),
        query(topProductsQuery, params),
        query(recentActivityQuery, params),
      ]);

    res.json({
      revenue: parseFloat(revRes.rows[0].val),
      orders: parseInt(ordRes.rows[0].val, 10),
      lowStock: parseInt(lowRes.rows[0].val, 10),
      products: parseInt(prodRes.rows[0].val, 10),
      sales: salesRes.rows,
      topProducts: topRes.rows.map((row) => ({
        ...row,
        revenue: parseFloat(row.revenue),
      })),
      recentActivity: activityRes.rows,
    });
  } catch (err) {
    next(asClientError(err));
  }
});

// GET /api/notifications
router.get("/notifications", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications
        WHERE user_id = $1 AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT 50`,
      [req.auth.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    next(asClientError(err));
  }
});

// PATCH /api/notifications/:id/read
router.patch("/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notifId = Number(req.params.id);
    if (!Number.isInteger(notifId) || notifId <= 0) {
      throw createHttpError(400, "Invalid notification ID");
    }
    
    const { rows } = await query(
      `UPDATE notifications 
          SET is_read = TRUE 
        WHERE notification_id = $1 AND user_id = $2
        RETURNING *`,
      [notifId, req.auth.user.user_id]
    );
    
    if (rows.length === 0) {
      throw createHttpError(404, "Notification not found");
    }
    
    res.json(rows[0]);
  } catch (err) {
    next(asClientError(err));
  }
});

// PATCH /api/notifications/read-all
router.patch("/notifications/read-all", requireAuth, async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications 
          SET is_read = TRUE 
        WHERE user_id = $1`,
      [req.auth.user.user_id]
    );
    res.json({ success: true });
  } catch (err) {
    next(asClientError(err));
  }
});

export default router;
