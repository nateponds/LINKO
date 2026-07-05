import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { peso, shortDate, statusClass } from "../lib/format";
import "./LogisticsPage.css";

/* Parcel detail + tracking timeline, backed by GET /api/parcels/:id.
   Demonstrates the ERD's core design decision live: current status is the
   latest tracking_logs row, not a column on parcels. */

const longDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const addressLine = (a) =>
  [a.street_address, a.barangay, a.city_municipality, a.province, a.postal_code]
    .filter(Boolean)
    .join(", ");

export default function ParcelDetailPage() {
  const { parcelId } = useParams();
  const navigate = useNavigate();

  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/parcels/${parcelId}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setParcel(data);
        setNotFound(!data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [parcelId]);

  // Newest first for display; the API sends the history oldest first.
  const timeline = parcel?.tracking_history ? [...parcel.tracking_history].reverse() : [];

  return (
    <AppLayout>
      <div className="logistics-page parcel-detail">
        <div className="parcel-subbar">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="parcel-subbar-right">
            <span className="tracking-label">Parcel No.</span>
            <span className="tracking-number">#{parcelId}</span>
          </div>
        </div>

        {loading ? (
          <div className="page-empty">Loading parcel…</div>
        ) : notFound ? (
          <div className="page-empty">We couldn't find a parcel with that number.</div>
        ) : error ? (
          <div className="page-empty">Could not load parcel: {error}</div>
        ) : (
          <main className="parcel-wrap">
            {/* LEFT: parties, package, payment */}
            <aside className="parcel-cards">
              <div className="parcel-card">
                <span className="card-heading">Sender</span>
                <span className="field-value"><strong>{parcel.sender.full_name}</strong></span>
                <span className="field-value muted">{parcel.sender.phone_number}</span>
                <span className="field-label">Origin</span>
                <span className="field-value">{addressLine(parcel.origin_address)}</span>
              </div>

              <div className="parcel-card">
                <span className="card-heading">Receiver</span>
                <span className="field-value"><strong>{parcel.receiver.full_name}</strong></span>
                <span className="field-value muted">{parcel.receiver.phone_number}</span>
                <span className="field-label">Destination</span>
                <span className="field-value">{addressLine(parcel.destination_address)}</span>
              </div>

              <div className="parcel-card">
                <span className="card-heading">Package</span>
                <div className="fact-grid">
                  <span className="field-label">Service Tier</span>
                  <span className="field-value">{parcel.tier.tier_name} ({parcel.tier.estimated_days}d)</span>
                  <span className="field-label">Weight</span>
                  <span className="field-value">{parcel.weight_kg} kg</span>
                  <span className="field-label">Dimensions</span>
                  <span className="field-value">{parcel.dimensions ?? "—"}</span>
                  <span className="field-label">Distance</span>
                  <span className="field-value">
                    {parcel.total_distance_km != null ? `${parcel.total_distance_km} km` : "—"}
                  </span>
                  <span className="field-label">Promised ETA</span>
                  <span className="field-value">{shortDate(parcel.estimated_delivery_date)}</span>
                </div>
              </div>

              <div className="parcel-card">
                <span className="card-heading">Payment</span>
                <div className="fact-grid">
                  <span className="field-label">Declared Value</span>
                  <span className="field-value">{peso(parcel.declared_value)}</span>
                  <span className="field-label">Shipping Fee</span>
                  <span className="field-value">{peso(parcel.shipping_fee)}</span>
                  <span className="field-label">Total ({parcel.payment?.method ?? "—"})</span>
                  <span className="field-value"><strong>{peso(parcel.payment?.amount)}</strong></span>
                  <span className="field-label">Payment Status</span>
                  <span className="field-value">{parcel.payment?.payment_status ?? "—"}</span>
                </div>
              </div>
            </aside>

            {/* RIGHT: status + timeline */}
            <section className="parcel-status-panel">
              <div className="parcel-status-head">
                <span className="status-eyebrow">This parcel is</span>
                <h1 className="status-title">{parcel.current_status ?? "Unknown"}</h1>
                <span className={`status ${statusClass(parcel.current_status)}`}>
                  {parcel.current_status ?? "—"}
                </span>
              </div>

              <div className="timeline-block">
                <span className="timeline-heading">Tracking History</span>
                <ol className="timeline">
                  {timeline.map((step, i) => (
                    <li
                      key={step.scanned_at + step.status_update}
                      className={`tl-step done ${i === 0 ? "current" : ""}`}
                    >
                      <span className="tl-dot" />
                      <div className="tl-content">
                        <span className="tl-title">{step.status_update}</span>
                        <span className="tl-meta">
                          {longDate(step.scanned_at)}
                          {step.branch_name ? ` — at ${step.branch_name}` : ""}
                          {step.courier_name ? ` · ${step.courier_name}` : ""}
                        </span>
                        {step.remarks && <span className="tl-remarks">{step.remarks}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </main>
        )}
      </div>
    </AppLayout>
  );
}
