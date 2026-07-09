import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { peso, shortDate, statusClass } from "../lib/format";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";
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
  const [branches, setBranches] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const { hasAnyRole } = useAuth();
  
  // Update form state
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [formStatus, setFormStatus] = useState("In Transit");
  const [formBranch, setFormBranch] = useState("");
  const [formCourier, setFormCourier] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const canUpdateAssignment = hasAnyRole(["logistics_coordinator", "platform_admin"]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [parcelData, branchData, courierData] = await Promise.all([
          apiGet(`/api/parcels/${parcelId}`).catch((e) => {
            if (e.statusCode === 404) return null;
            throw e;
          }),
          apiGet("/api/branches").catch(() => []),
          apiGet("/api/couriers").catch(() => []),
        ]);
        if (cancelled) return;
        setParcel(parcelData);
        setNotFound(!parcelData);
        setBranches(Array.isArray(branchData) ? branchData : []);
        setCouriers(Array.isArray(courierData) ? courierData : []);
        if (parcelData) {
          setFormStatus(parcelData.current_status ?? "In Transit");
          setFormBranch(parcelData.latest_branch_id ? String(parcelData.latest_branch_id) : "");
          setFormCourier(parcelData.latest_courier_id ? String(parcelData.latest_courier_id) : "");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    load();

    return () => {
      cancelled = true;
    };
  }, [parcelId]);

  // Newest first for display; the API sends the history oldest first.
  const timeline = parcel?.tracking_history ? [...parcel.tracking_history].reverse() : [];
  const filteredCouriers = formBranch
    ? couriers.filter((courier) => courier.assigned_branch_id === Number(formBranch))
    : couriers;

  async function handleTrackingSubmit() {
    if (updating) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      const body = { status_update: formStatus, remarks: formRemarks };
      if (canUpdateAssignment) {
        if (formBranch) body.branch_id = Number(formBranch);
        if (formCourier) body.courier_id = Number(formCourier);
      }

      await apiSend(`/api/parcels/${parcelId}/tracking`, { body });
      const data = await apiGet(`/api/parcels/${parcelId}`);
      setParcel(data);
      setFormStatus(data.current_status ?? formStatus);
      setFormBranch(data.latest_branch_id ? String(data.latest_branch_id) : "");
      setFormCourier(data.latest_courier_id ? String(data.latest_courier_id) : "");
      setFormRemarks("");
    } catch(err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  }

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
                <span className="field-value"><strong>{parcel.sender.business_name}</strong></span>
                <span className="field-value muted">{parcel.sender.contact_number}</span>
                <span className="field-label">Origin</span>
                <span className="field-value">{addressLine(parcel.origin_address)}</span>
              </div>

              <div className="parcel-card">
                <span className="card-heading">Receiver</span>
                <span className="field-value"><strong>{parcel.receiver.business_name}</strong></span>
                <span className="field-value muted">{parcel.receiver.contact_number}</span>
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

              {hasAnyRole(["logistics_coordinator", "platform_admin", "courier"]) && (
                <div className="update-status-form">
                  <h3>Update Tracking</h3>
                  {updateError && <p className="form-error">{updateError}</p>}
                  
                  <div className="update-status-grid">
                    <label>
                      <span>Status</span>
                      <select 
                        value={formStatus} 
                        onChange={e => setFormStatus(e.target.value)}
                      >
                        <option value="Order Created">Order Created</option>
                        <option value="Picked Up">Picked Up</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Returned">Returned</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </label>

                    {canUpdateAssignment && (
                      <>
                        <label>
                          <span>Log at Branch</span>
                          <select
                            value={formBranch}
                            onChange={e => setFormBranch(e.target.value)}
                          >
                            <option value="">-- None --</option>
                            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                          </select>
                        </label>

                        <label>
                          <span>Assign Courier</span>
                          <select
                            value={formCourier}
                            onChange={e => setFormCourier(e.target.value)}
                          >
                            <option value="">-- None --</option>
                            {filteredCouriers.map(c => <option key={c.courier_id} value={c.courier_id}>{c.full_name}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  
                  <label className="update-remarks">
                    <span>Remarks</span>
                    <input 
                      type="text" 
                      value={formRemarks} 
                      onChange={e => setFormRemarks(e.target.value)}
                      placeholder="Optional remarks"
                    />
                  </label>
                  
                  <button 
                    onClick={handleTrackingSubmit}
                    disabled={updating}
                    className="update-submit"
                  >
                    {updating ? "Saving..." : "Log Update"}
                  </button>
                </div>
              )}

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
