import { Router } from "express";
import { getPool } from "../db.js";
import { createHttpError, isPlatformAdmin } from "../middleware/ownership.js";
import { createBusiness, parseBusiness, validateBusinessType } from "../services/businesses.js";

const router = Router();

router.post("/", async (req, res) => {
  if (isPlatformAdmin(req.auth.user)) {
    throw createHttpError(403, "Platform admins cannot add businesses");
  }
  // Couriers and coordinators are operational staff: like admins they never
  // join the marketplace, whichever business is active. Checked account-wide.
  if (req.auth.memberships.some((m) => m.role === "courier" || m.role === "logistics_coordinator")) {
    throw createHttpError(403, "Logistics staff cannot add businesses");
  }
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
