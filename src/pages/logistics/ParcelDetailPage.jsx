import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import TrackingTimeline from "../../features/logistics/TrackingTimeline";
import SupportModal from "../../components/ui/SupportModal";
import { ParcelRouteMap } from "../../components/ui/MapPicker";
import { peso, shortDate, statusClass } from "../../lib/format";
import {
  returnTriggeredFromHistory,
  isReturning,
  selectableTrackingStatuses,
  ONE_TAP_REMARKS,
  FAIL_REASONS,
} from "../../lib/statusWorkflow";
import { useAuth } from "../../auth/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";
import "./logistics.css";

/* Parcel detail + tracking timeline, backed by GET /api/parcels/:id.
   Demonstrates the ERD's core design decision live: current status is the
   latest tracking_logs row, not a column on parcels. */

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
  const [supportOpen, setSupportOpen] = useState(false);

  // Update form state
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [formStatus, setFormStatus] = useState("");
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

  const filteredCouriers = formBranch
    ? couriers.filter((courier) => courier.assigned_branch_id === Number(formBranch))
    : couriers;
  // Return leg is derived from the rendered history — retry cap or a hard-fail
  // reason opens it. Mirrors the backend's return_triggered list field.
  const returnTriggered = returnTriggeredFromHistory(parcel?.tracking_history);
  const statusOptions = selectableTrackingStatuses(
    parcel?.current_status,
    canUpdateAssignment,
    returnTriggered,
  );
  const canLogTrackingUpdate = canUpdateAssignment || statusOptions.length > 0;
  const selectedStatus = statusOptions.includes(formStatus)
    ? formStatus
    : statusOptions.includes(parcel?.current_status)
      ? parcel.current_status
      : statusOptions[0] ?? "";
  // Return-leg red cue: return triggered and not yet back at the sender.
  const returning = isReturning(parcel?.current_status, returnTriggered);

  async function handleTrackingSubmit() {
    if (updating) return;
    if (selectedStatus === "Cancelled" && !formRemarks.trim()) {
      setUpdateError("A cancellation reason is required.");
      return;
    }
    if (selectedStatus === "Delivery Failed" && !FAIL_REASONS.includes(formRemarks)) {
      setUpdateError("A failure reason is required.");
      return;
    }
    setUpdating(true);
    setUpdateError(null);
    try {
      const body = { status_update: selectedStatus };
      if (canUpdateAssignment) {
        // Coordinator/admin override: manual remark + explicit assignment.
        if (formRemarks) body.remarks = formRemarks;
        if (formBranch) body.branch_id = Number(formBranch);
        if (formCourier) body.courier_id = Number(formCourier);
      } else {
        // Courier: fixed remark per status; Delivery Failed carries the picked
        // reason; terminal scans and branch checkpoints send nothing (backend
        // auto-generates the POD / branch-name remark).
        const remark =
          selectedStatus === "Delivery Failed" ? formRemarks : ONE_TAP_REMARKS[selectedStatus];
        if (remark) body.remarks = remark;
      }

      await apiSend(`/api/parcels/${parcelId}/tracking`, { body });
      const data = await apiGet(`/api/parcels/${parcelId}`);
      setParcel(data);
      setFormStatus("");
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
            <section className={`parcel-status-panel${returning ? " is-returning" : ""}`}>
              <div className="parcel-status-head">
                <span className="status-eyebrow">
                  {returning ? "Returning to sender — this parcel is" : "This parcel is"}
                </span>
                <h1 className="status-title">{parcel.current_status ?? "Unknown"}</h1>
                <span className={`status ${statusClass(parcel.current_status)}`}>
                  {parcel.current_status ?? "—"}
                </span>
              </div>

              <ParcelRouteMap
                key={`${parcel.parcel_id}-${parcel.planned_route?.length ? "planned" : "empty"}`}
                stops={parcel.planned_route}
              />

              {hasAnyRole(["logistics_coordinator", "platform_admin", "courier"]) && (
                <div className="update-status-form">
                  <h3>Log Delivery Event</h3>
                  {updateError && <p className="form-error">{updateError}</p>}
                  {canLogTrackingUpdate ? (
                    <>
                      <div className="update-status-grid">
                        <label>
                          <span>Delivery status</span>
                          <select
                            value={selectedStatus}
                            onChange={e => setFormStatus(e.target.value)}
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
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

                      {/* Delivery Failed always uses the canned reason picker,
                          every role — hard reasons drive the return-leg gate, so
                          free text is never allowed here. Couriers never free-type
                          (handoff 2026-07-16 §5): the status carries a fixed remark,
                          terminal scans an auto-generated POD. Only the
                          coordinator/admin override keeps a manual remarks box for
                          the other statuses. */}
                      {selectedStatus === "Delivery Failed" ? (
                        <label className="update-remarks">
                          <span>Reason</span>
                          <select value={formRemarks} onChange={e => setFormRemarks(e.target.value)}>
                            <option value="">-- Select reason --</option>
                            {FAIL_REASONS.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                        </label>
                      ) : canUpdateAssignment ? (
                        <label className="update-remarks">
                          <span>{selectedStatus === "Cancelled" ? "Cancellation reason" : "Remarks"}</span>
                          <input
                            type="text"
                            value={formRemarks}
                            onChange={e => setFormRemarks(e.target.value)}
                            required={selectedStatus === "Cancelled"}
                            placeholder={
                              selectedStatus === "Cancelled"
                                ? "Required — why this parcel is being cancelled"
                                : selectedStatus === "Delivered" || selectedStatus === "Returned"
                                  ? "Optional — proof of delivery is auto-generated"
                                  : "Optional delivery notes"
                            }
                          />
                        </label>
                      ) : null}

                      <button
                        onClick={handleTrackingSubmit}
                        disabled={updating}
                        className="update-submit"
                      >
                        {updating ? "Saving..." : "Log Event"}
                      </button>
                    </>
                  ) : (
                    <p className="form-note">This parcel has reached a final courier outcome.</p>
                  )}
                </div>
              )}

              <button
                type="button"
                className="support-link-btn"
                onClick={() => setSupportOpen(true)}
              >
                Need help? Contact customer service
              </button>

              <TrackingTimeline parcel={parcel} />
            </section>
          </main>
        )}

        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      </div>
    </AppLayout>
  );
}
