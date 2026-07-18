import { haversineKmSql } from "./location.js";

// Shared initial-branch resolver (Sprint 13 T04). Replaces the duplicated
// findBranchIdByCity copies in orders.js and logistics.js. Runs on the
// caller's client so it participates in the enclosing transaction.
//
// Resolution chain (docs/LOCATION_ROUTING.md):
//   1. Origin address has coordinates -> Haversine nearest branch among
//      is_active AND is_available AND fully pinned branches;
//      ORDER BY distance ASC, branch_id ASC (deterministic tiebreak).
//   2. Otherwise (unpinned origin, or no pinned candidate) -> city fallback:
//      LOWER(TRIM(city_municipality)) match among active + available
//      branches, ORDER BY branch_id. Permanent safety net — never deleted.
//   3. Otherwise NULL — the parcel is still created branchless and awaits
//      manual coordinator assignment. A miss never fails parcel creation.
export async function resolveInitialBranchId(client, originAddressId) {
  if (!originAddressId) return null;

  const origin = await client.query(
    `SELECT latitude::float8 AS latitude, longitude::float8 AS longitude, city_municipality
       FROM addresses
      WHERE address_id = $1`,
    [originAddressId],
  );
  if (!origin.rows.length) return null;
  const { latitude, longitude, city_municipality } = origin.rows[0];

  if (latitude !== null && longitude !== null) {
    const { rows } = await client.query(
      `SELECT b.branch_id
         FROM branches b
         JOIN addresses a ON a.address_id = b.address_id
        WHERE b.is_active
          AND b.is_available
          AND a.latitude IS NOT NULL
          AND a.longitude IS NOT NULL
        ORDER BY ${haversineKmSql("$1", "$2", "a.latitude", "a.longitude")} ASC,
                 b.branch_id ASC
        LIMIT 1`,
      [latitude, longitude],
    );
    if (rows.length) return rows[0].branch_id;
  }

  if (typeof city_municipality === "string" && city_municipality.trim() !== "") {
    const { rows } = await client.query(
      `SELECT b.branch_id
         FROM branches b
         JOIN addresses a ON a.address_id = b.address_id
        WHERE b.is_active
          AND b.is_available
          AND LOWER(TRIM(a.city_municipality)) = LOWER(TRIM($1))
        ORDER BY b.branch_id
        LIMIT 1`,
      [city_municipality],
    );
    if (rows.length) return rows[0].branch_id;
  }

  return null;
}
