// Shared coordinate validation (Sprint 13 T03). Pure — no DB, no HTTP.
// One policy for every surface that accepts coordinates (settings, branches,
// parcel booking), mirroring the migration 023 CHECK constraints:
// paired, in range, finite, never exactly (0,0) ("Null Island").

// Guarded coercion: only actual numbers and non-empty numeric strings count.
// Number(null), Number("") and Number(true) all coerce to 0/1 — those must
// NOT sneak in as coordinates, so anything else returns NaN.
function coerceCoordinate(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

// Validates a coordinate pair from untrusted input. Returns
//   { ok: true, latitude, longitude }  — normalized numbers, or both null
//                                        (explicit unpin: gates re-engage)
//   { ok: false, error }               — human-readable rejection reason
export function validateCoordinatePair(latitude, longitude) {
  const latMissing = latitude === null || latitude === undefined;
  const lngMissing = longitude === null || longitude === undefined;

  if (latMissing && lngMissing) {
    return { ok: true, latitude: null, longitude: null };
  }
  if (latMissing || lngMissing) {
    return { ok: false, error: "latitude and longitude must be provided together" };
  }

  const lat = coerceCoordinate(latitude);
  const lng = coerceCoordinate(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "latitude and longitude must be finite numbers" };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, error: "latitude must be between -90 and 90" };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, error: "longitude must be between -180 and 180" };
  }
  if (lat === 0 && lng === 0) {
    return { ok: false, error: "coordinates (0,0) are not a real location" };
  }

  // -0 === 0, so this normalizes -0 to 0 before it reaches SQL or JSON
  return { ok: true, latitude: lat === 0 ? 0 : lat, longitude: lng === 0 ? 0 : lng };
}
