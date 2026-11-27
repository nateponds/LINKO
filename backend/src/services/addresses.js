import { query } from "../db.js";

export const ADDRESS_RETURNING_SQL = `address_id, label, province, city_municipality, barangay,
            street_address, postal_code,
            latitude::float8 AS latitude, longitude::float8 AS longitude, is_default`;

export const BUSINESS_PRIMARY_ADDRESS_JOIN_SQL = `
  LEFT JOIN LATERAL (
    SELECT province, city_municipality, street_address
      FROM addresses
     WHERE business_id = b.business_id
     ORDER BY address_id ASC
     LIMIT 1
  ) a ON TRUE`;

export function shapeAddress(row) {
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

export async function findBusinessLogisticsAddress(businessId, db = { query }) {
  const { rows } = await db.query(
    `SELECT a.address_id, a.province, a.city_municipality, a.barangay,
            a.street_address, a.postal_code,
            a.latitude::float8 AS latitude, a.longitude::float8 AS longitude
       FROM businesses b
       LEFT JOIN addresses a ON a.address_id = b.logistics_address_id
      WHERE b.business_id = $1`,
    [businessId],
  );
  return rows[0] ?? null;
}

export async function listBusinessAddresses(businessId, db = { query }) {
  const { rows } = await db.query(
    `SELECT ${ADDRESS_RETURNING_SQL}
       FROM addresses
      WHERE business_id = $1
      ORDER BY is_default DESC, address_id ASC`,
    [businessId],
  );
  return rows;
}
