import { useEffect, useRef, useState } from "react";

// Shared click-to-pin map (Sprint 13 §9.4). Dumb controlled component: the
// parent owns draft/saved coordinate state; this only renders it and reports
// picks via onChange({ latitude, longitude }) as numbers. Positional
// [lng, lat] arrays exist ONLY inside this file — everything else in the app
// speaks named latitude/longitude.
//
// Geocoder is pin assist only: a search result moves the map and pin and
// shows the matched label as a hint, but never writes the normalized address
// text fields (PH barangay coverage is spotty; manual click is ground truth).
//
// mapbox-gl is dynamically imported so the main bundle doesn't carry it and
// a missing VITE_MAPBOX_TOKEN or a failed load degrades to nothing — the
// parents' numeric coordinate inputs remain the always-working fallback.

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Cebu metro — matches the seeded branch geometry demoed for the course.
const DEFAULT_CENTER = [123.9, 10.33];

function toFinite(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function MapPicker({ latitude, longitude, onChange, onStatusChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapboxglRef = useRef(null);
  // Ref so map event handlers registered once always call the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [status, setStatus] = useState(TOKEN ? "loading" : "no-token");

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  const [geocoderHint, setGeocoderHint] = useState(null);

  const lat = toFinite(latitude);
  const lng = toFinite(longitude);
  const hasPin = lat !== null && lng !== null;

  useEffect(() => {
    if (!TOKEN) return undefined;
    let cancelled = false;

    async function init() {
      try {
        const [mapboxModule, geocoderModule] = await Promise.all([
          import("mapbox-gl"),
          import("@mapbox/mapbox-gl-geocoder"),
          import("mapbox-gl/dist/mapbox-gl.css"),
          import("@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css"),
        ]);
        if (cancelled || !containerRef.current) return;

        const mapboxgl = mapboxModule.default ?? mapboxModule;
        const MapboxGeocoder = geocoderModule.default ?? geocoderModule;
        mapboxgl.accessToken = TOKEN;
        mapboxglRef.current = mapboxgl;

        const startLat = toFinite(latitude);
        const startLng = toFinite(longitude);
        const startPin = startLat !== null && startLng !== null;

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: startPin ? [startLng, startLat] : DEFAULT_CENTER,
          zoom: startPin ? 14 : 10,
        });
        mapRef.current = map;

        map.on("click", (e) => {
          onChangeRef.current?.({
            latitude: Number(e.lngLat.lat.toFixed(6)),
            longitude: Number(e.lngLat.wrap().lng.toFixed(6)),
          });
        });

        const geocoder = new MapboxGeocoder({
          accessToken: TOKEN,
          mapboxgl,
          marker: false, // our controlled marker is the only pin
          countries: "ph",
          placeholder: "Search to move the pin",
        });
        geocoder.on("result", ({ result }) => {
          setGeocoderHint(result.place_name);
          const [resultLng, resultLat] = result.center;
          onChangeRef.current?.({
            latitude: Number(resultLat.toFixed(6)),
            longitude: Number(resultLng.toFixed(6)),
          });
        });
        map.addControl(geocoder);
        map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        // Bad token / style fetch failure before "load" → degrade to inputs.
        map.on("error", () => {
          if (!cancelled) {
            setStatus((s) => (s === "loading" ? "failed" : s));
          }
        });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }

    init();
    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Init exactly once; live coordinates sync via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prop → marker sync (map clicks, geocoder picks, and manual numeric edits
  // all flow through the parent and land here).
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (status !== "ready" || !map || !mapboxgl) return;

    if (!hasPin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
    map.easeTo({ center: [lng, lat] });
  }, [status, hasPin, lat, lng]);

  if (status === "no-token" || status === "failed") {
    return (
      <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.5rem 0" }}>
        {status === "no-token"
          ? "Map unavailable (no Mapbox token configured)"
          : "Map failed to load"}
        {" — use the coordinate fields below."}
      </p>
    );
  }

  return (
    <div style={{ margin: "0.5rem 0" }}>
      <div
        ref={containerRef}
        style={{ height: "280px", borderRadius: "8px", overflow: "hidden" }}
      />
      <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.4rem 0 0" }}>
        {status === "loading"
          ? "Loading map…"
          : "Click the map to place the pin. Search moves the pin only — the address fields stay yours to edit."}
      </p>
      {geocoderHint && (
        <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.2rem 0 0" }}>
          Matched: {geocoderHint}
        </p>
      )}
    </div>
  );
}

export function ParcelRouteMap({ stops }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState(TOKEN ? "loading" : "no-token");

  const routeStops = Array.isArray(stops) ? stops : [];
  const mappedStops = routeStops.filter(
    (stop) => toFinite(stop.latitude) !== null && toFinite(stop.longitude) !== null,
  );

  useEffect(() => {
    if (!TOKEN || mappedStops.length === 0) return undefined;
    let cancelled = false;

    async function init() {
      try {
        const [mapboxModule] = await Promise.all([
          import("mapbox-gl"),
          import("mapbox-gl/dist/mapbox-gl.css"),
        ]);
        if (cancelled || !containerRef.current) return;

        const mapboxgl = mapboxModule.default ?? mapboxModule;
        mapboxgl.accessToken = TOKEN;
        const coordinates = mappedStops.map((stop) => [
          Number(stop.longitude),
          Number(stop.latitude),
        ]);
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: coordinates[0],
          zoom: 11,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;

          if (coordinates.length > 1) {
            map.addSource("planned-route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates },
              },
            });
            map.addLayer({
              id: "planned-route",
              type: "line",
              source: "planned-route",
              paint: {
                "line-color": "#176b5b",
                "line-width": 3,
                "line-dasharray": [2, 2],
              },
            });
          }

          coordinates.forEach((coordinate, index) => {
            const marker = document.createElement("span");
            marker.className = "parcel-route-marker";
            marker.textContent = String(mappedStops[index].stop_order);
            marker.title = mappedStops[index].label;
            new mapboxgl.Marker({ element: marker }).setLngLat(coordinate).addTo(map);
          });

          const bounds = coordinates.reduce(
            (box, coordinate) => box.extend(coordinate),
            new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
          );
          map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 0 });
          map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
          setStatus("ready");
        });
        map.on("error", () => {
          if (!cancelled) {
            setStatus((current) => (current === "loading" ? "failed" : current));
          }
        });
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Route snapshots are immutable; initialize once for this parcel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (routeStops.length === 0) {
    return (
      <section className="parcel-route" aria-labelledby="planned-route-heading">
        <h2 id="planned-route-heading">Planned route</h2>
        <p className="parcel-route-empty">
          No planned route is available. Branchless and legacy parcels may not have a saved plan.
        </p>
      </section>
    );
  }

  return (
    <section className="parcel-route" aria-labelledby="planned-route-heading">
      <h2 id="planned-route-heading">Planned route</h2>
      {mappedStops.length > 0 && status !== "no-token" && status !== "failed" && (
        <div
          ref={containerRef}
          className="parcel-route-map"
          role="img"
          aria-label="Map of planned parcel route"
        />
      )}
      {mappedStops.length === 0 ? (
        <p className="parcel-route-map-note">No stops with coordinates are available to map.</p>
      ) : status === "no-token" ? (
        <p className="parcel-route-map-note">Map unavailable (no Mapbox token configured).</p>
      ) : status === "failed" ? (
        <p className="parcel-route-map-note">Map failed to load.</p>
      ) : status === "loading" ? (
        <p className="parcel-route-map-note">Loading planned route map…</p>
      ) : null}
      <p className="parcel-route-caption">approximate route — not road directions</p>
      <ol className="parcel-route-stops">
        {routeStops.map((stop) => {
          const hasCoordinates =
            toFinite(stop.latitude) !== null && toFinite(stop.longitude) !== null;
          return (
            <li key={`${stop.stop_order}-${stop.stop_type}`}>
              <span className="parcel-route-stop-number">{stop.stop_order}</span>
              <span>
                <strong>{stop.label}</strong>
                <small>
                  {stop.stop_type}
                  {!hasCoordinates ? " — location not mapped" : ""}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
