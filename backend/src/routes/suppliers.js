import { Router } from "express";
import { query } from "../db.js";

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

router.get("/", async (req, res, next) => {
  try {
    const conditions = ["b.business_type IN ('wholesaler', 'both')"];
    const params = [];

    if (req.query.q !== undefined && req.query.q !== "") {
      params.push(`%${req.query.q}%`);
      conditions.push(`b.business_name ILIKE $${params.length}`);
    }
    if (req.query.category_id !== undefined) {
      params.push(Number(req.query.category_id));
      conditions.push(`EXISTS (
        SELECT 1 FROM products p
         WHERE p.business_id = b.business_id
           AND p.is_active = TRUE
           AND p.category_id = $${params.length}
      )`);
    }

    const { rows } = await query(
      `SELECT b.business_id,
              b.business_name,
              b.city,
              b.address_line,
              b.is_verified,
              (SELECT COUNT(*)::int FROM products p
                WHERE p.business_id = b.business_id AND p.is_active = TRUE) AS product_count
         FROM businesses b
        WHERE ${conditions.join(" AND ")}
        ORDER BY b.business_name`,
      params,
    );
    res.json(rows);
  } catch (error) {
    next(asClientError(error));
  }
});

export default router;
