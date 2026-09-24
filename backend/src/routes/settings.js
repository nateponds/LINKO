import { Router } from "express";
import { getPool, query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError, getActiveMembership, requirePositiveInt } from "../middleware/ownership.js";
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
const TEXT_LIMITS = {
  province: 50,
  city_municipality: 50,
  barangay: 50,
  street_address: 150,
  postal_code: 10,
};

const ADDRESS_RETURNING = `address_id, label, province, city_municipality, barangay,
            street_address, postal_code,
            latitude::float8 AS latitude, longitude::float8 AS longitude, is_default`;

function addressBookKind(membership) {
  if (membership.business_type === "both") return "mixed";
  if (membership.role === "wholesaler" || membership.business_type === "wholesaler") return "pickup";
  if (membership.role === "buyer" || membership.business_type === "buyer") return "delivery";
  return "mixed";
}

function shapeAddress(row) {
  const latitude = row.latitude ?? null;
  const longitude = row.longitude ?? null;
  return {
    address_id: row.address_id,
    label: row.label ?? null,
    province: row.province ?? null,
    city_municipality: row.city_municipality ?? null,
    barangay: row.barangay ?? null,
    street_address: row.street_address ?? null,
    postal_code: row.postal_code ?? null,
    latitude,
    longitude,
    has_coordinates: latitude !== null && longitude !== null,
    is_default: Boolean(row.is_default),
  };
}

function readAddressBody(body) {
  const source = body ?? {};
  const label = typeof source.label === "string" ? source.label.trim() : "";
  if (!label) {
    throw createHttpError(400, "label is required");
  }
  if (label.length > 80) {
    throw createHttpError(400, "label must be at most 80 characters");
  }

  const text = {};
  for (const field of TEXT_FIELDS) {
    const value = source[field];
    if (typeof value !== "string" || value.trim() === "") {
      throw createHttpError(400, `${field} is required`);
    }
    const trimmed = value.trim();
    if (trimmed.length > TEXT_LIMITS[field]) {
      throw createHttpError(400, `${field} is too long`);
    }
    text[field] = trimmed;
  }

  const coords = validateCoordinatePair(source.latitude, source.longitude);
  if (!coords.ok) {
    throw createHttpError(400, coords.error);
  }

  return {
    label,
    ...text,
    latitude: coords.latitude,
    longitude: coords.longitude,
    is_default: source.is_default === true,
  };
}

// The canonical pin and the single default address are the same row.
async function alignDefaultWithPin(client, businessId, addressId) {
  await client.query(
    `UPDATE addresses
        SET is_default = FALSE
      WHERE business_id = $1 AND is_default AND address_id <> $2`,
    [businessId, addressId],
  );
  await client.query(
    `UPDATE addresses
        SET is_default = TRUE
      WHERE address_id = $1 AND business_id = $2`,
    [addressId, businessId],
  );
  await client.query(
    "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = $2",
    [addressId, businessId],
  );
}

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
           (business_id, label, province, city_municipality, barangay, street_address, postal_code, latitude, longitude, is_default)
         VALUES ($1, 'Primary', $2, $3, $4, $5, $6, $7, $8, FALSE)
         RETURNING address_id`,
        [membership.business_id, text.province, text.city_municipality, text.barangay,
          text.street_address, text.postal_code, coords.latitude, coords.longitude],
      );
      savedAddressId = inserted.rows[0].address_id;
    }
    await alignDefaultWithPin(client, membership.business_id, savedAddressId);
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

router.get("/addresses", requireAuth, async (req, res, next) => {
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const { rows } = await query(
      `SELECT ${ADDRESS_RETURNING}
         FROM addresses
        WHERE business_id = $1
        ORDER BY is_default DESC, address_id ASC`,
      [membership.business_id],
    );
    res.json({
      business_id: membership.business_id,
      business_type: membership.business_type,
      address_book_kind: addressBookKind(membership),
      addresses: rows.map(shapeAddress),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/addresses", requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const input = readAddressBody(req.body);

    await client.query("BEGIN");
    await client.query(
      "SELECT business_id FROM businesses WHERE business_id = $1 FOR UPDATE",
      [membership.business_id],
    );
    const count = await client.query(
      "SELECT COUNT(*)::int AS count FROM addresses WHERE business_id = $1",
      [membership.business_id],
    );
    const makeDefault = input.is_default || count.rows[0].count === 0;
    if (makeDefault) {
      await client.query(
        "UPDATE addresses SET is_default = FALSE WHERE business_id = $1 AND is_default",
        [membership.business_id],
      );
    }

    const inserted = await client.query(
      `INSERT INTO addresses
         (business_id, label, province, city_municipality, barangay, street_address,
          postal_code, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${ADDRESS_RETURNING}`,
      [membership.business_id, input.label, input.province, input.city_municipality,
        input.barangay, input.street_address, input.postal_code,
        input.latitude, input.longitude, makeDefault],
    );
    if (makeDefault) {
      await client.query(
        "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = $2",
        [inserted.rows[0].address_id, membership.business_id],
      );
    }
    await client.query("COMMIT");
    res.status(201).json(shapeAddress(inserted.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

router.put("/addresses/:id", requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const addressId = requirePositiveInt(req.params.id, "address id");
    const input = readAddressBody(req.body);

    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE addresses
          SET label = $3, province = $4, city_municipality = $5, barangay = $6,
              street_address = $7, postal_code = $8, latitude = $9, longitude = $10
        WHERE address_id = $1 AND business_id = $2
        RETURNING ${ADDRESS_RETURNING}`,
      [addressId, membership.business_id, input.label, input.province, input.city_municipality,
        input.barangay, input.street_address, input.postal_code, input.latitude, input.longitude],
    );
    if (!updated.rows[0]) {
      throw createHttpError(404, "Address not found");
    }
    await client.query("COMMIT");
    res.json(shapeAddress(updated.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

router.post("/addresses/:id/default", requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const addressId = requirePositiveInt(req.params.id, "address id");

    await client.query("BEGIN");
    await client.query(
      "SELECT business_id FROM businesses WHERE business_id = $1 FOR UPDATE",
      [membership.business_id],
    );
    const existing = await client.query(
      `SELECT ${ADDRESS_RETURNING}
         FROM addresses
        WHERE address_id = $1 AND business_id = $2
        FOR UPDATE`,
      [addressId, membership.business_id],
    );
    if (!existing.rows[0]) {
      throw createHttpError(404, "Address not found");
    }
    await alignDefaultWithPin(client, membership.business_id, addressId);
    const saved = await client.query(
      `SELECT ${ADDRESS_RETURNING} FROM addresses WHERE address_id = $1`,
      [addressId],
    );
    await client.query("COMMIT");
    res.json(shapeAddress(saved.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

router.delete("/addresses/:id", requireAuth, async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const membership = getActiveMembership(req, MARKETPLACE_ROLES);
    const addressId = requirePositiveInt(req.params.id, "address id");

    await client.query("BEGIN");
    await client.query(
      "SELECT business_id FROM businesses WHERE business_id = $1 FOR UPDATE",
      [membership.business_id],
    );
    const existing = await client.query(
      `SELECT address_id, is_default
         FROM addresses
        WHERE address_id = $1 AND business_id = $2
        FOR UPDATE`,
      [addressId, membership.business_id],
    );
    if (!existing.rows[0]) {
      throw createHttpError(404, "Address not found");
    }
    const count = await client.query(
      "SELECT COUNT(*)::int AS count FROM addresses WHERE business_id = $1",
      [membership.business_id],
    );
    if (count.rows[0].count <= 1) {
      throw createHttpError(409, "Add another address before deleting the last one");
    }
    if (existing.rows[0].is_default) {
      throw createHttpError(409, "Set another address as the default before deleting this one");
    }
    await client.query("DELETE FROM addresses WHERE address_id = $1 AND business_id = $2", [
      addressId,
      membership.business_id,
    ]);
    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23503") {
      next(createHttpError(409, "This address is still referenced and cannot be deleted"));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

export default router;
