import { createHttpError } from "../middleware/ownership.js";

const BUSINESS_TYPES = new Set(["buyer", "wholesaler"]);

export function parseBusiness(body) {
  return {
    businessName: typeof body?.business_name === "string" ? body.business_name.trim() : "",
    businessType: typeof body?.business_type === "string" ? body.business_type.trim() : "",
  };
}

export function validateBusinessType(businessType) {
  if (!BUSINESS_TYPES.has(businessType)) {
    throw createHttpError(400, "business_type must be buyer or wholesaler");
  }
}

export async function createBusiness(client, userId, businessName, businessType) {
  const businessResult = await client.query(
    `INSERT INTO businesses (business_name, business_type)
     VALUES ($1, $2)
     RETURNING business_id, business_name, business_type`,
    [businessName, businessType],
  );

  // The placeholder address becomes the canonical logistics pin. It has no
  // coordinates, so the new business correctly hits the pin gates and the
  // missing-location banner until it saves a real location in Settings.
  const addressResult = await client.query(
    `INSERT INTO addresses
     (business_id, label, province, city_municipality, barangay, street_address, postal_code, is_default)
     VALUES ($1, 'Primary', 'Not provided', 'Not provided', 'Not provided', 'Not provided', '0000', TRUE)
     RETURNING address_id`,
    [businessResult.rows[0].business_id],
  );

  await client.query(
    "UPDATE businesses SET logistics_address_id = $1 WHERE business_id = $2",
    [addressResult.rows[0].address_id, businessResult.rows[0].business_id],
  );

  await client.query(
    "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
    [userId, businessResult.rows[0].business_id],
  );

  // Sprint 9: a business is either a buyer or a wholesaler, never both.
  // The one_marketplace_role_per_business partial unique index enforces
  // this at the schema level; here we just insert the single role.
  const membershipRole = businessType;
  await client.query(
    "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, $3)",
    [userId, businessResult.rows[0].business_id, membershipRole],
  );

  return { ...businessResult.rows[0], role: membershipRole, has_coordinates: false };
}
