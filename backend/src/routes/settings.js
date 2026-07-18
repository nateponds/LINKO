import { Router } from "express";
import { getPool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError, getActiveMembership } from "../middleware/ownership.js";
import { validateCoordinatePair } from "../services/location.js";

// Business location settings (Sprint 13 T10, docs/API_CONTRACTS.md §5).
// The canonical logistics location of the ACTIVE business — a buyer's
// delivery location / a wholesaler's pickup location. This is the one surface
// that repairs the unpinned placeholder address registration creates.
// Platform admins get no global bypass: they edit a location only through an
// actual buyer/wholesaler membership of their own.

const router = Router();

const MARKETPLACE_ROLES = ["buyer", "wholesaler"];
const TEXT_FIELDS = ["province", "city_municipality", "barangay", "street_address", "postal_code"];

function shapeLocation(membership, addressRow) {
  const a = addressRow ?? {};
  const latitude = a.latitude ?? null;
  const longitude = a.longitude ?? null;
  return {
    business_id: membership.business_id,
    business_type: membership.business_type,
    address_id: a.address_id ?? null,
    province: a.province ?? null,
    city_municipality: a.city_municipality ?? null,
    barangay: a.barangay ?? null,
    street_address: a.street_address ?? null,
    postal_code: a.postal_code ?? null,
    latitude,
    longitude,
    has_coordinates: latitude !== null && longitude !== null,
  };
}

router.get("/location", requireAuth, async (req, res, next) => {
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const { rows } = await query(
      `SELECT a.address_id, a.province, a.city_municipality, a.barangay,
              a.street_address, a.postal_code,
              a.latitude::float8 AS latitude, a.longitude::float8 AS longitude
         FROM businesses b
         LEFT JOIN addresses a ON a.address_id = b.logistics_address_id
        WHERE b.business_id = $1`,
      [membership.business_id],
    );
    res.json(shapeLocation(membership, rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/location", requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const body = req.body ?? {};

    const text = {};
    for (const field of TEXT_FIELDS) {
      const value = body[field];
      if (typeof value !== "string" || value.trim() === "") {
        throw createHttpError(400, `${field} is required`);
      }
      text[field] = value.trim();
    }

    const coords = validateCoordinatePair(body.latitude, body.longitude);
    if (!coords.ok) {
      throw createHttpError(400, coords.error);
    }

    // Create-or-update in one transaction: update the row the pointer names;
    // if the pointer (or its row) is absent, insert a complete address and
    // set the pointer. FOR UPDATE serializes concurrent saves on the pointer.
    await client.query("BEGIN");
    const pointer = await client.query(
      "SELECT logistics_address_id FROM businesses WHERE business_id = $1 FOR UPDATE",
      [membership.business_id],
    );
    const pointedId = pointer.rows[0]?.logistics_address_id ?? null;

    let savedAddressId = null;
    if (pointedId !== null) {
      const updated = await client.query(
        `UPDATE addresses
            SET province = $2, city_municipality = $3, barangay = $4,
                street_address = $5, postal_code = $6, latitude = $7, longitude = $8
          WHERE address_id = $1
          RETURNING address_id`,
        [pointedId, text.province, text.city_municipality, text.barangay,
          text.street_address, text.postal_code, coords.latitude, coords.longitude],
      );
      savedAddressId = updated.rows[0]?.address_id ?? null;
    }
    if (savedAddressId === null) {
      const inserted = await client.query(
        `INSERT INTO addresses
           (business_id, province, city_municipality, barangay, street_address, postal_code, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING address_id`,
        [membership.business_id, text.province, text.city_municipality, text.barangay,
          text.street_address, text.postal_code, coords.latitude, coords.longitude],
      );
      savedAddressId = inserted.rows[0].address_id;
      await client.query(
        "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = $2",
        [savedAddressId, membership.business_id],
      );
    }
    await client.query("COMMIT");

    res.json(shapeLocation(membership, {
      address_id: savedAddressId,
      ...text,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

export default router;
