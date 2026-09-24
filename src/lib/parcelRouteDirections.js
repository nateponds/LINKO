// Pure parcel-route decisions for Mapbox Directions.
// Coordinates are [longitude, latitude]. The helper never fetches; the loader
// is optional and only calls the injected fetch when a token is present.

const EARTH_RADIUS_M = 6371008.8;

export const ROAD_MATCH_METERS = 200;

export const ROUTE_CAPTIONS = {
  roads: "Route follows roads.",
  noToken: "Dashed line — no Mapbox token.",
  unavailable: "Dashed line — directions unavailable.",
  offRoad: "Dashed line — off-road location.",
  noCoordinates: "Dashed line — a stop has no coordinates.",
  noLegs: "No driving legs between stops.",
  mixedOffRoad: "Route follows roads; dashed line for off-road locations.",
  mixedNoCoordinates: "Route follows roads; dashed line where a stop has no coordinates.",
  mixedUnavailable: "Route follows roads where available; dashed line where directions are unavailable.",
  mixed: "Route follows roads; dashed line where a leg cannot follow the road.",
};

function toFinite(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isPair(value) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function pair(value) {
  if (!isPair(value)) return null;
  return [Number(value[0]), Number(value[1])];
}

export function haversineMeters(a, b) {
  const start = pair(a);
  const end = pair(b);
  if (!start || !end) return Infinity;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(end[1] - start[1]);
  const dLng = toRad(end[0] - start[0]);
  const lat1 = toRad(start[1]);
  const lat2 = toRad(end[1]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function stopCoordinate(stop) {
  const latitude = toFinite(stop?.latitude);
  const longitude = toFinite(stop?.longitude);
  if (latitude === null || longitude === null) return null;
  return [longitude, latitude];
}

function straightLine(from, to) {
  if (!from || !to) return null;
  return { type: "LineString", coordinates: [from, to] };
}

function lineCoordinates(geometry) {
  if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
    return null;
  }
  const coordinates = geometry.coordinates.map(pair).filter(Boolean);
  return coordinates.length >= 2 ? coordinates : null;
}

function nearestIndex(coordinates, target, fromIndex) {
  let best = fromIndex;
  let bestDistance = Infinity;
  for (let index = fromIndex; index < coordinates.length; index += 1) {
    const distance = haversineMeters(coordinates[index], target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return { index: best, distance: bestDistance };
}

function overviewSlice(overview, start, end, cursor) {
  const line = lineCoordinates(overview);
  if (!line || !start || !end) return { coordinates: null, cursor };
  const startHit = nearestIndex(line, start, cursor);
  const nextCursor = startHit.index;
  if (startHit.distance > ROAD_MATCH_METERS) {
    return { coordinates: null, cursor: nextCursor };
  }
  const endHit = nearestIndex(line, end, startHit.index);
  const slice = line.slice(startHit.index, endHit.index + 1);
  return {
    coordinates: endHit.distance <= ROAD_MATCH_METERS && slice.length >= 2 ? slice : null,
    cursor: endHit.index,
  };
}

function waypointLocation(response, index) {
  return pair(response?.waypoints?.[index]?.location);
}

function responseRoute(response) {
  if (!response || response.code !== "Ok" || !Array.isArray(response.routes)) return null;
  return response.routes[0] ?? null;
}

/**
 * Contiguous runs of stops that have coordinates. A missing coordinate breaks
 * the run so Directions is not asked to bridge an unmapped stop.
 */
export function routableGroups(stops) {
  const list = Array.isArray(stops) ? stops : [];
  const groups = [];
  let current = [];
  list.forEach((stop, index) => {
    const coord = stopCoordinate(stop);
    if (coord) {
      current.push({ index, coord });
      return;
    }
    if (current.length) groups.push(current);
    current = [];
  });
  if (current.length) groups.push(current);
  return groups
    .filter((group) => group.length >= 2)
    .map((group) => ({
      indexes: group.map((stop) => stop.index),
      coordinates: group.map((stop) => stop.coord),
    }));
}

export function buildDrivingDirectionsUrl(coordinates, token) {
  if (!token || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  const path = coordinates.map((coordinate) => {
    const point = pair(coordinate);
    if (!point) return null;
    return `${point[0]},${point[1]}`;
  });
  if (path.some((part) => part === null)) return null;
  const params = new URLSearchParams();
  params.set("geometries", "geojson");
  params.set("overview", "full");
  params.set("access_token", token);
  return `https://api.mapbox.com/directions/v5/mapbox/driving/${path.join(";")}?${params}`;
}

function responsesFor(directions, groupCount) {
  if (groupCount === 0) return [];
  if (Array.isArray(directions)) return directions;
  if (groupCount === 1) return [directions ?? null];
  return [];
}

function captionFor(legs, failure) {
  if (failure === "no-token" || legs.some((leg) => leg.reason === "no-token")) {
    return ROUTE_CAPTIONS.noToken;
  }
  if (legs.length === 0) {
    return failure === "unavailable" ? ROUTE_CAPTIONS.unavailable : ROUTE_CAPTIONS.noLegs;
  }
  const dashed = legs.filter((leg) => leg.kind === "dashed");
  if (dashed.length === 0) return ROUTE_CAPTIONS.roads;

  const reasons = new Set(dashed.map((leg) => leg.reason));
  const hasRoad = dashed.length !== legs.length;
  const offRoad = reasons.has("off-road") || reasons.has("unmatched");
  const missing = reasons.has("no-coordinates");
  const unavailable = reasons.has("unavailable") || failure === "unavailable";

  if (!hasRoad && unavailable && !offRoad) return ROUTE_CAPTIONS.unavailable;
  if (!hasRoad && missing && !offRoad && !unavailable) return ROUTE_CAPTIONS.noCoordinates;
  if (!hasRoad && offRoad && !missing && !unavailable) return ROUTE_CAPTIONS.offRoad;
  if (hasRoad && offRoad && !missing && !unavailable) return ROUTE_CAPTIONS.mixedOffRoad;
  if (hasRoad && missing && !offRoad && !unavailable) return ROUTE_CAPTIONS.mixedNoCoordinates;
  if (hasRoad && unavailable && !offRoad && !missing) return ROUTE_CAPTIONS.mixedUnavailable;
  if (!hasRoad && offRoad) return ROUTE_CAPTIONS.offRoad;
  return hasRoad ? ROUTE_CAPTIONS.mixed : ROUTE_CAPTIONS.unavailable;
}

function dashedLeg(index, from, to, reason) {
  return {
    index,
    kind: "dashed",
    reason,
    geometry: straightLine(from, to),
  };
}

function classifyGroup(legs, group, response) {
  const route = responseRoute(response);
  const waypoints = response?.waypoints;
  if (
    !route
    || (Array.isArray(waypoints) && waypoints.length !== group.indexes.length)
  ) {
    group.indexes.slice(0, -1).forEach((stopIndex) => {
      const leg = legs.find((candidate) => candidate.index === stopIndex && !candidate.kind);
      if (!leg) return;
      legs[leg.index] = dashedLeg(stopIndex, leg.from, leg.to, "unavailable");
    });
    return;
  }

  const overview = route.geometry;
  let cursor = 0;
  for (let offset = 0; offset < group.indexes.length - 1; offset += 1) {
    const stopIndex = group.indexes[offset];
    const leg = legs.find((candidate) => candidate.index === stopIndex && !candidate.kind);
    if (!leg) continue;
    const apiLeg = Array.isArray(route.legs) ? route.legs[offset] : null;
    if (!apiLeg) {
      legs[stopIndex] = dashedLeg(stopIndex, leg.from, leg.to, "unmatched");
      continue;
    }

    const explicit = lineCoordinates(apiLeg.geometry);
    const start = waypointLocation(response, offset) ?? explicit?.[0] ?? null;
    const end = waypointLocation(response, offset + 1) ?? explicit?.[explicit.length - 1] ?? null;
    const onRoad = Boolean(
      start
      && end
      && haversineMeters(start, leg.from) <= ROAD_MATCH_METERS
      && haversineMeters(end, leg.to) <= ROAD_MATCH_METERS,
    );
    if (!onRoad) {
      legs[stopIndex] = dashedLeg(stopIndex, leg.from, leg.to, "off-road");
      const sliced = overviewSlice(overview, start, end, cursor);
      cursor = sliced.cursor;
      continue;
    }

    let coordinates = explicit;
    if (!coordinates) {
      const sliced = overviewSlice(overview, start, end, cursor);
      cursor = sliced.cursor;
      coordinates = sliced.coordinates;
    }
    if (!coordinates) {
      legs[stopIndex] = dashedLeg(stopIndex, leg.from, leg.to, "unmatched");
      continue;
    }
    legs[stopIndex] = {
      index: stopIndex,
      kind: "road",
      reason: "road",
      geometry: { type: "LineString", coordinates },
    };
  }
}

/**
 * Decide each leg between consecutive stops.
 * `directions` is a Mapbox Directions GeoJSON body, an array of bodies aligned
 * with routableGroups(stops), or null when the request did not succeed.
 * `failure` is "no-token" or "unavailable" for a whole-route fallback.
 * Never throws.
 */
export function classifyRouteLegs(stops, directions, options = {}) {
  const failure = options.failure ?? null;
  const list = Array.isArray(stops) ? stops : [];
  const coordinates = list.map(stopCoordinate);
  const legs = [];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index];
    const to = coordinates[index + 1];
    if (!from || !to) {
      legs.push(dashedLeg(index, from, to, "no-coordinates"));
      continue;
    }
    legs.push({ index, kind: null, reason: null, from, to, geometry: null });
  }

  if (failure === "no-token" || failure === "unavailable") {
    for (let index = 0; index < legs.length; index += 1) {
      if (legs[index].kind) continue;
      legs[index] = dashedLeg(index, legs[index].from, legs[index].to, failure);
    }
  } else {
    const groups = routableGroups(list);
    const responses = responsesFor(directions, groups.length);
    if (groups.length > 1 && !Array.isArray(directions)) {
      groups.forEach((group) => classifyGroup(legs, group, null));
    } else {
      groups.forEach((group, groupIndex) => {
        classifyGroup(legs, group, responses[groupIndex] ?? null);
      });
    }
    for (let index = 0; index < legs.length; index += 1) {
      if (legs[index].kind) continue;
      legs[index] = dashedLeg(index, legs[index].from, legs[index].to, "unavailable");
    }
  }

  const published = legs.map((leg) => ({
    index: leg.index,
    kind: leg.kind,
    reason: leg.reason,
    geometry: leg.geometry,
  }));
  return { legs: published, caption: captionFor(published, failure) };
}

/**
 * Fetch driving directions for each contiguous run of mapped stops.
 * Returns { responses, failure } and never throws. Does not call fetch without a token.
 */
export async function loadDrivingDirections(stops, token, fetchImpl = globalThis.fetch) {
  if (!token) return { responses: [], failure: "no-token" };
  const groups = routableGroups(stops);
  if (groups.length === 0) return { responses: [], failure: null };

  const responses = [];
  let failed = 0;
  for (const group of groups) {
    const url = buildDrivingDirectionsUrl(group.coordinates, token);
    try {
      const response = await fetchImpl(url);
      if (!response?.ok) {
        responses.push(null);
        failed += 1;
        continue;
      }
      const body = await response.json();
      if (!body || body.code !== "Ok" || !Array.isArray(body.routes) || !body.routes[0]) {
        responses.push(null);
        failed += 1;
        continue;
      }
      responses.push(body);
    } catch {
      responses.push(null);
      failed += 1;
    }
  }

  return {
    responses,
    failure: failed === groups.length ? "unavailable" : null,
  };
}
