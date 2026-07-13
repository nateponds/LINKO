import { Router } from "express";
import { query } from "../db.js";
import { isPlatformAdmin, memberBusinessIds } from "../middleware/ownership.js";

const router = Router();

// Sprint 10: read-only warehouse lookup so the frontend can populate the
// add-stock warehouse picker. Shape per docs/API_CONTRACTS.md section 1.4.
// warehouses has no city column; city comes from the warehouse's address,
// same join GET /api/inventory already uses. Admins see all warehouses;
// everyone else only their own businesses'.
router.get("/", async (req, res, next) => {
  try {
    const params = [];
    let where = "";
    if (!isPlatformAdmin(req.auth.user)) {
      params.push(memberBusinessIds(req));
      where = "WHERE w.business_id = ANY($1::int[])";
    }
    const { rows } = await query(
      `SELECT w.warehouse_id,
              w.warehouse_name,
              a.city_municipality AS city
         FROM warehouses w
         JOIN addresses a ON a.address_id = w.address_id
         ${where}
        ORDER BY w.warehouse_id`,
      params,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
