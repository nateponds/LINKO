import { Router } from "express";
import { getPool, query } from "../db.js";
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

// GET /api/dashboard
// Returns stats for the active user's businesses
router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const { user, memberships } = req.auth;
    const businessIds = memberships.map(m => m.business_id);
    
    if (businessIds.length === 0 && user.global_role !== "platform_admin") {
       return res.json({
         revenue: 0,
         orders: 0,
         lowStock: 0,
         products: 0,
         sales: [0,0,0,0,0,0,0,0,0,0,0,0]
       });
    }

    let revenueQuery = "SELECT 0 AS val";
    let ordersQuery = "SELECT 0 AS val";
    let lowStockQuery = "SELECT 0 AS val";
    let productsQuery = "SELECT 0 AS val";
    let params = [];

    if (user.global_role === "platform_admin") {
      revenueQuery = `SELECT COALESCE(SUM(total), 0) AS val FROM invoices`;
      ordersQuery = `SELECT COUNT(*) AS val FROM orders`;
      lowStockQuery = `SELECT COUNT(*) AS val FROM products WHERE stock_quantity < 10`;
      productsQuery = `SELECT COUNT(*) AS val FROM products`;
    } else {
      params = [businessIds];
      revenueQuery = `
        SELECT COALESCE(SUM(i.total), 0) AS val
          FROM invoices i
          JOIN orders o ON o.order_id = i.order_id
         WHERE o.wholesaler_business_id = ANY($1::int[])`;
      
      ordersQuery = `
        SELECT COUNT(*) AS val 
          FROM orders 
         WHERE wholesaler_business_id = ANY($1::int[]) OR buyer_business_id = ANY($1::int[])`;
         
      lowStockQuery = `
        SELECT COUNT(*) AS val 
          FROM products 
         WHERE business_id = ANY($1::int[]) AND stock_quantity < 10`;
         
      productsQuery = `
        SELECT COUNT(*) AS val 
          FROM products 
         WHERE business_id = ANY($1::int[])`;
    }

    const [revRes, ordRes, lowRes, prodRes] = await Promise.all([
      query(revenueQuery, params),
      query(ordersQuery, params),
      query(lowStockQuery, params),
      query(productsQuery, params)
    ]);

    const revVal = parseFloat(revRes.rows[0].val);

    res.json({
      revenue: revVal,
      orders: parseInt(ordRes.rows[0].val, 10),
      lowStock: parseInt(lowRes.rows[0].val, 10),
      products: parseInt(prodRes.rows[0].val, 10),
      sales: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, revVal * 0.4, revVal] // Fake trend for the chart
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
        WHERE user_id = $1 
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

export default router;
