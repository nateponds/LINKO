import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import StarRating from "../components/ui/StarRating";
import { suppliers } from "../data/suppliers";
import "./MatchingPage.css";

/* Matching MVP is proximity-only by design (see docs/BACKEND_GUIDE.md):
   buyer location vs wholesaler location, ranked by distance, with the
   proximity reason surfaced. Category/MOQ/lead-time are deferred. */

const CITY_COORDS = {
  "Cebu City": { lat: 10.3157, lng: 123.8854 },
  Manila: { lat: 14.5995, lng: 120.9842 },
  "Davao City": { lat: 7.1907, lng: 125.4553 },
  "Cagayan de Oro": { lat: 8.4542, lng: 124.6319 },
  "General Santos City": { lat: 6.1164, lng: 125.1716 },
  "Baguio City": { lat: 16.4023, lng: 120.596 },
  "Iloilo City": { lat: 10.7202, lng: 122.5621 },
  "Bacolod City": { lat: 10.677, lng: 122.9503 },
  "Tagaytay City": { lat: 14.1153, lng: 120.9621 },
};

const CITIES = Object.keys(CITY_COORDS).sort();

function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function matchesFor(buyerCity) {
  const from = CITY_COORDS[buyerCity];
  return suppliers
    .map((supplier) => ({
      ...supplier,
      distance: Math.round(distanceKm(from, CITY_COORDS[supplier.location])),
    }))
    .sort((a, b) => a.distance - b.distance);
}

function proximityReason(match, buyerCity) {
  if (match.distance === 0) {
    return `Matched because ${match.supplier_name} operates in ${buyerCity}, the same city as you.`;
  }
  return `Matched because ${match.supplier_name} is based in ${match.location}, ≈${match.distance} km from ${buyerCity}.`;
}

export default function MatchingPage() {
  const [buyerCity, setBuyerCity] = useState("");
  const matches = buyerCity ? matchesFor(buyerCity) : [];

  return (
    <AppLayout>
      <div className="matching-page">
        <div className="matching-heading">
          <h1>Find Wholesalers Near You</h1>
          <p className="matching-sub">
            We rank wholesalers by proximity to your business and show why each
            one matched. Category, MOQ, and lead-time filters are coming later.
          </p>
        </div>

        <div className="matching-form">
          <label htmlFor="buyer-city">
            <MapPin size={16} /> Your business location
          </label>
          <select
            id="buyer-city"
            value={buyerCity}
            onChange={(e) => setBuyerCity(e.target.value)}
          >
            <option value="">Select your city…</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {!buyerCity ? (
          <div className="matching-empty">
            <Navigation size={36} />
            <p>Pick your city above and we&apos;ll rank wholesalers nearest to you.</p>
          </div>
        ) : (
          <ol className="match-list">
            {matches.map((match, index) => (
              <li key={match.slug}>
                <Link to={`/suppliers/${match.slug}`} className="match-card">
                  <span className="match-rank">{index + 1}</span>
                  <img
                    className="match-photo"
                    src={match.supplier_image}
                    alt={`${match.supplier_name} storefront`}
                  />
                  <div className="match-info">
                    <div className="match-name-row">
                      <h3>{match.supplier_name}</h3>
                      {index === 0 && (
                        <span className="match-badge">Nearest match</span>
                      )}
                      {match.distance === 0 && index !== 0 && (
                        <span className="match-badge same-city">Same city</span>
                      )}
                    </div>
                    <StarRating rating={match.rating} />
                    <p className="match-reason">
                      {proximityReason(match, buyerCity)}
                    </p>
                  </div>
                  <div className="match-distance">
                    <span className="distance-value">
                      {match.distance === 0 ? "Local" : `≈${match.distance} km`}
                    </span>
                    <span className="distance-label">{match.location}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppLayout>
  );
}
