import { Router } from "express";
import { getPool } from "../db.js";
import { createHttpError } from "../lib/httpErrors.js";
import { MARKETPLACE_ROLES, requireAnyRole } from "../middleware/auth.js";
import { createBusiness, parseBusiness, validateBusinessType } from "../services/businesses.js";

const router = Router();

router.post("/", requireAnyRole(MARKETPLACE_ROLES), async (req, res) => {
  const { businessName, businessType } = parseBusiness(req.body);
  if (!businessName || !businessType) {
    throw createHttpError(400, "Missing required fields");
  }
  validateBusinessType(businessType);

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const membership = await createBusiness(client, req.auth.user.user_id, businessName, businessType);
    await client.query("COMMIT");
    res.status(201).json(membership);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export default router;
