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
// Server-authoritative pricing distance: direct origin -> destination
// Haversine in km. One formula for both creation paths; branch choice never
// affects price. Returns null when either endpoint is unpinned or missing
// (the pin gates make that defensive-only for new parcels).
export async function computeRouteDistanceKm(client, originAddressId, destinationAddressId) {
  const { rows } = await client.query(
    `SELECT (${haversineKmSql("o.latitude", "o.longitude", "d.latitude", "d.longitude")})::float8 AS distance_km
       FROM addresses o, addresses d
      WHERE o.address_id = $1
        AND d.address_id = $2`,
    [originAddressId, destinationAddressId],
  );
  return rows[0]?.distance_km ?? null;
}

// Immutable planned-route snapshot: origin -> branch -> destination, with
// address text and coordinates COPIED (never joined later) so re-pinning a
// business or branch never rewrites history. ON CONFLICT DO NOTHING on the
// (parcel_id, stop_order) PK makes creation idempotent under retries; an
// existing snapshot is never recomputed.
export async function createInitialRouteSnapshot(client, parcelId, branchId) {
  if (!branchId) return;
  await client.query(
    `INSERT INTO parcel_route_stops
       (parcel_id, stop_order, stop_type, source_address_id, branch_id,
        label, province, city_municipality, barangay, street_address, postal_code,
        latitude, longitude)
     SELECT p.parcel_id, 1, 'origin', a.address_id, NULL,
            sb.business_name, a.province, a.city_municipality, a.barangay,
            a.street_address, a.postal_code, a.latitude, a.longitude
       FROM parcels p
       JOIN addresses a ON a.address_id = p.origin_address_id
       JOIN businesses sb ON sb.business_id = p.sender_id
      WHERE p.parcel_id = $1
     UNION ALL
     SELECT p.parcel_id, 2, 'branch', ba.address_id, b.branch_id,
            b.branch_name, ba.province, ba.city_municipality, ba.barangay,
            ba.street_address, ba.postal_code, ba.latitude, ba.longitude
       FROM parcels p
       CROSS JOIN branches b
       JOIN addresses ba ON ba.address_id = b.address_id
      WHERE p.parcel_id = $1
        AND b.branch_id = $2
     UNION ALL
     SELECT p.parcel_id, 3, 'destination', a.address_id, NULL,
            rb.business_name, a.province, a.city_municipality, a.barangay,
            a.street_address, a.postal_code, a.latitude, a.longitude
       FROM parcels p
       JOIN addresses a ON a.address_id = p.destination_address_id
       JOIN businesses rb ON rb.business_id = p.receiver_id
      WHERE p.parcel_id = $1
     ON CONFLICT (parcel_id, stop_order) DO NOTHING`,
    [parcelId, branchId],
  );
}

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
