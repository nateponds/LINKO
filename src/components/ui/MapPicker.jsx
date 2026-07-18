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

export default function MapPicker({ latitude, longitude, onChange }) {
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
