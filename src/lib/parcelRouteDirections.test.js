import test from "node:test";
import assert from "node:assert/strict";

import {
  ROAD_MATCH_METERS,
  ROUTE_CAPTIONS,
  buildDrivingDirectionsUrl,
  classifyRouteLegs,
  haversineMeters,
  loadDrivingDirections,
  routableGroups,
} from "./parcelRouteDirections.js";

const EARTH_RADIUS_M = 6371008.8;

function stop(longitude, latitude, extra = {}) {
  return { latitude, longitude, ...extra };
}

function offsetNorth([lng, lat], meters) {
  const δ = meters / EARTH_RADIUS_M;
  const φ1 = (lat * Math.PI) / 180;
  const φ2 = φ1 + δ;
  return [lng, (φ2 * 180) / Math.PI];
}

function directions({ waypoints, overview, legs }) {
  return {
    code: "Ok",
    waypoints: waypoints.map((location) => ({ location })),
    routes: [
      {
        geometry: { type: "LineString", coordinates: overview },
        legs: legs ?? waypoints.slice(1).map(() => ({ summary: "road" })),
      },
    ],
  };
}

test("haversine stays on the 200 meter match threshold", () => {
  const origin = [123.9, 10.33];
  const near = offsetNorth(origin, 150);
  const far = offsetNorth(origin, 250);
  assert.ok(Math.abs(haversineMeters(origin, near) - 150) < 0.05);
  assert.ok(haversineMeters(origin, near) <= ROAD_MATCH_METERS);
  assert.ok(haversineMeters(origin, far) > ROAD_MATCH_METERS);
});

test("driving directions URL uses the driving profile and GeoJSON overview", () => {
  const url = buildDrivingDirectionsUrl(
    [[123.9137, 10.3444], [123.9234, 10.3243], [123.8988, 10.3283]],
    "pk.test",
  );
  assert.equal(
    url,
    "https://api.mapbox.com/directions/v5/mapbox/driving/123.9137,10.3444;123.9234,10.3243;123.8988,10.3283?geometries=geojson&overview=full&access_token=pk.test",
  );
  assert.equal(buildDrivingDirectionsUrl([[123.9, 10.33]], "pk.test"), null);
  assert.equal(buildDrivingDirectionsUrl([[123.9, 10.33], [123.91, 10.34]], ""), null);
});

test("a matched leg uses the road geometry instead of the straight line", () => {
  const stops = [stop(0, 0), stop(0.02, 0.01), stop(0.04, 0)];
  const bend = [0.01, 0.02];
  const secondBend = [0.03, 0.02];
  const overview = [[0, 0], bend, [0.02, 0.01], secondBend, [0.04, 0]];
  const result = classifyRouteLegs(
    stops,
    directions({
      waypoints: [[0, 0], [0.02, 0.01], [0.04, 0]],
      overview,
    }),
  );

  assert.equal(result.caption, ROUTE_CAPTIONS.roads);
  assert.deepEqual(result.legs.map((leg) => leg.kind), ["road", "road"]);
  assert.deepEqual(result.legs[0].geometry.coordinates, [[0, 0], bend, [0.02, 0.01]]);
  assert.deepEqual(result.legs[1].geometry.coordinates, [[0.02, 0.01], secondBend, [0.04, 0]]);
  assert.notDeepEqual(result.legs[0].geometry.coordinates, [[0, 0], [0.02, 0.01]]);
});

test("a leg is dashed when either snapped end is farther than 200 meters", () => {
  const origin = [123.9, 10.33];
  const middle = [123.91, 10.34];
  const destination = [123.92, 10.33];
  const snappedDestination = offsetNorth(destination, 250);
  const overview = [origin, middle, snappedDestination, [123.93, 10.5]];
  const result = classifyRouteLegs(
    [stop(...origin), stop(...middle), stop(...destination)],
    directions({
      waypoints: [origin, middle, snappedDestination],
      overview,
    }),
  );

  assert.equal(result.caption, ROUTE_CAPTIONS.mixedOffRoad);
  assert.equal(result.legs[0].kind, "road");
  assert.equal(result.legs[0].reason, "road");
  assert.equal(result.legs[1].kind, "dashed");
  assert.equal(result.legs[1].reason, "off-road");
  assert.deepEqual(result.legs[1].geometry.coordinates, [middle, destination]);
});

test("explicit leg geometry is kept when both ends match the requested stops", () => {
  const from = [123.9, 10.33];
  const to = [123.91, 10.331];
  const road = [from, [123.905, 10.335], to];
  const result = classifyRouteLegs(
    [stop(...from), stop(...to)],
    {
      code: "Ok",
      waypoints: [{ location: from }, { location: to }],
      routes: [{
        legs: [{ geometry: { type: "LineString", coordinates: road } }],
      }],
    },
  );
  assert.equal(result.legs[0].kind, "road");
  assert.deepEqual(result.legs[0].geometry.coordinates, road);
});

test("a missing leg, an error code, and a null body fall back without throwing", () => {
  const stops = [stop(123.9, 10.33), stop(123.91, 10.34)];
  const missing = classifyRouteLegs(stops, directions({
    waypoints: [[123.9, 10.33], [123.91, 10.34]],
    overview: [[123.9, 10.33], [123.91, 10.34]],
    legs: [],
  }));
  assert.equal(missing.legs[0].kind, "dashed");
  assert.equal(missing.legs[0].reason, "unmatched");
  assert.equal(missing.caption, ROUTE_CAPTIONS.offRoad);
  assert.deepEqual(missing.legs[0].geometry.coordinates, [[123.9, 10.33], [123.91, 10.34]]);

  const errored = classifyRouteLegs(stops, { code: "NoRoute", routes: [] });
  assert.equal(errored.legs[0].reason, "unavailable");
  assert.equal(errored.caption, ROUTE_CAPTIONS.unavailable);

  const empty = classifyRouteLegs(stops, null);
  assert.equal(empty.legs[0].reason, "unavailable");
  assert.equal(empty.caption, ROUTE_CAPTIONS.unavailable);
  assert.doesNotThrow(() => classifyRouteLegs(null, { code: "Ok" }));
});

test("no token and missing coordinates dash the affected legs and say why", () => {
  const stops = [
    stop(123.9, 10.33),
    stop(123.91, 10.34),
    { latitude: null, longitude: null, label: "unmapped" },
    stop(123.92, 10.35),
  ];
  const withoutToken = classifyRouteLegs(stops, null, { failure: "no-token" });
  assert.equal(withoutToken.caption, ROUTE_CAPTIONS.noToken);
  assert.deepEqual(
    withoutToken.legs.map((leg) => leg.reason),
    ["no-token", "no-coordinates", "no-coordinates"],
  );
  assert.deepEqual(withoutToken.legs[0].geometry.coordinates, [[123.9, 10.33], [123.91, 10.34]]);
  assert.equal(withoutToken.legs[1].geometry, null);

  const unmapped = classifyRouteLegs(
    [stop(1, 2), { latitude: "", longitude: " " }, stop(3, 4)],
    null,
  );
  assert.equal(unmapped.caption, ROUTE_CAPTIONS.noCoordinates);
  assert.deepEqual(unmapped.legs.map((leg) => leg.reason), ["no-coordinates", "no-coordinates"]);
});

test("a whole-request failure is captioned unavailable even if a body is ignored", () => {
  const stops = [stop(0, 0), stop(0.01, 0.01)];
  const result = classifyRouteLegs(
    stops,
    directions({ waypoints: [[0, 0], [0.01, 0.01]], overview: [[0, 0], [0.01, 0.02], [0.01, 0.01]] }),
    { failure: "unavailable" },
  );
  assert.equal(result.legs[0].kind, "dashed");
  assert.equal(result.legs[0].reason, "unavailable");
  assert.deepEqual(result.legs[0].geometry.coordinates, [[0, 0], [0.01, 0.01]]);
  assert.equal(result.caption, ROUTE_CAPTIONS.unavailable);
});

test("loader requests only routable groups and never calls the network without a token", async () => {
  const stops = [
    stop(123.9, 10.33),
    stop(123.91, 10.34),
    { latitude: null, longitude: null },
    stop(123.95, 10.36),
    stop(123.96, 10.37),
  ];
  assert.deepEqual(routableGroups(stops).map((group) => group.coordinates), [
    [[123.9, 10.33], [123.91, 10.34]],
    [[123.95, 10.36], [123.96, 10.37]],
  ]);

  let calls = 0;
  const blocked = await loadDrivingDirections(stops, "", () => {
    calls += 1;
    throw new Error("network");
  });
  assert.equal(calls, 0);
  assert.equal(blocked.failure, "no-token");

  const urls = [];
  const loaded = await loadDrivingDirections(stops, "pk.test", async (url) => {
    urls.push(url);
    if (urls.length === 1) {
      return {
        ok: true,
        json: async () => directions({
          waypoints: [[123.9, 10.33], [123.91, 10.34]],
          overview: [[123.9, 10.33], [123.905, 10.335], [123.91, 10.34]],
        }),
      };
    }
    throw new Error("directions down");
  });
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/driving\/123\.9,10\.33;123\.91,10\.34\?/);
  assert.match(urls[0], /geometries=geojson/);
  assert.match(urls[0], /overview=full/);
  assert.equal(loaded.failure, null);
  assert.equal(loaded.responses[1], null);

  const classified = classifyRouteLegs(stops, loaded.responses);
  assert.equal(classified.legs[0].kind, "road");
  assert.deepEqual(classified.legs[0].geometry.coordinates, [
    [123.9, 10.33],
    [123.905, 10.335],
    [123.91, 10.34],
  ]);
  assert.equal(classified.legs[3].reason, "unavailable");
  assert.equal(classified.caption, ROUTE_CAPTIONS.mixed);

  const down = await loadDrivingDirections(
    [stop(1, 2), stop(3, 4)],
    "pk.test",
    async () => ({ ok: false, json: async () => ({}) }),
  );
  assert.equal(down.failure, "unavailable");
  assert.deepEqual(down.responses, [null]);
});
