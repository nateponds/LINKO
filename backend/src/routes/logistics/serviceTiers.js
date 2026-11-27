import { Router } from "express";
import { query } from "../../db.js";
import { requireAnyRole, requireAuth } from "../../middleware/auth.js";
import {
  asClientError,
  createHttpError,
  PLATFORM_ADMIN_ROLES,
  SERVICE_TIER_READ_ROLES,
} from "./shared.js";

const router = Router();

router.get(
  "/service-tiers",
  requireAuth,
  requireAnyRole(SERVICE_TIER_READ_ROLES),
  async (_req, res) => {
    const { rows } = await query(`
      SELECT tier_id, tier_name, base_fee::float8, base_rate_per_kg::float8,
             rate_per_km::float8, estimated_days
        FROM service_tiers
       ORDER BY tier_id`);

    res.json(rows);
  },
);

router.put(
  "/service-tiers/:id",
  requireAuth,
  requireAnyRole(PLATFORM_ADMIN_ROLES),
  async (req, res, next) => {
    const tierId = Number(req.params.id);
    const {
      tier_name,
      base_fee,
      base_rate_per_kg,
      rate_per_km,
      estimated_days,
    } = req.body ?? {};

    // Validate required fields
    if (!tier_name || typeof tier_name !== "string" || !tier_name.trim()) {
      return next(createHttpError(400, "tier_name is required"));
    }

    const numBaseFee = Number(base_fee);
    const numBaseRate = Number(base_rate_per_kg);
    const numRateKm = Number(rate_per_km);
    const numDays = Number(estimated_days);

    if (
      [numBaseFee, numBaseRate, numRateKm].some(
        (v) => Number.isNaN(v) || v < 0,
      )
    ) {
      return next(
        createHttpError(
          400,
          "base_fee, base_rate_per_kg, and rate_per_km must be numbers >= 0",
        ),
      );
    }
    if (Number.isNaN(numDays) || !Number.isInteger(numDays) || numDays < 1) {
      return next(
        createHttpError(400, "estimated_days must be an integer >= 1"),
      );
    }

    try {
      const { rows } = await query(
        `UPDATE service_tiers
            SET tier_name = $1, base_fee = $2, base_rate_per_kg = $3,
                rate_per_km = $4, estimated_days = $5
          WHERE tier_id = $6
          RETURNING tier_id, tier_name, base_fee::float8, base_rate_per_kg::float8,
                    rate_per_km::float8, estimated_days`,
        [tier_name.trim(), numBaseFee, numBaseRate, numRateKm, numDays, tierId],
      );

      if (!rows.length) {
        return next(createHttpError(404, "Service tier not found"));
      }

      res.json(rows[0]);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

export default router;
