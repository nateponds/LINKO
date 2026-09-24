import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import TrackingTimeline from "../../features/logistics/TrackingTimeline";
import SupportModal from "../../components/ui/SupportModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { ParcelRouteMap } from "../../components/ui/MapPicker";
import { peso, shortDate, statusClass } from "../../lib/format";
import {
  returnTriggeredFromHistory,
  isReturning,
  ONE_TAP_REMARKS,
  FAIL_REASONS,
} from "../../lib/statusWorkflow";
import { useAuth } from "../../auth/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";
import { LogisticsNotice, LogisticsPlaceholder } from "./LogisticsStates";
import { formatNextStatuses, nextStatusesForRole } from "./workflowHints";
import "./logistics.css";

/* Parcel detail + tracking timeline, backed by GET /api/parcels/:id.
   Demonstrates the ERD's core design decision live: current status is the
   latest tracking_logs row, not a column on parcels. */

const addressLine = (a) =>
  [a.street_address, a.barangay, a.city_municipality, a.province, a.postal_code]
    .filter(Boolean)
    .join(", ");

// An assigned courier stays selected. Otherwise preselect the branch
// suggestion; the coordinator can still clear or replace it before submit.
function courierSelection(parcel) {
  if (parcel.latest_courier_id) return String(parcel.latest_courier_id);
  if (parcel.suggested_courier_id) return String(parcel.suggested_courier_id);
  return "";
}

export default function ParcelDetailPage() {
  const { parcelId } = useParams();
  const navigate = useNavigate();

  const [reloadToken, setReloadToken] = useState(0);
  const [loadState, setLoadState] = useState({ key: null, parcel: null, notFound: false, error: null, branches: [], couriers: [] });
  const { hasAnyRole } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  // Update form state
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [formStatus, setFormStatus] = useState("");
  const [formBranch, setFormBranch] = useState("");
  const [formCourier, setFormCourier] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const canUpdateAssignment = hasAnyRole(["logistics_coordinator", "platform_admin"]);

  const loadKey = `${parcelId}:${reloadToken}`;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const [parcelData, branchData, courierData] = await Promise.all([
          apiGet(`/api/parcels/${parcelId}`, { signal: controller.signal }).catch((e) => {
            if (e.statusCode === 404) return null;
            throw e;
          }),
          apiGet("/api/branches/options", { signal: controller.signal }).catch(() => []),
          apiGet("/api/couriers/options", { signal: controller.signal }).catch(() => []),
        ]);
        if (cancelled) return;
        setLoadState({
          key: loadKey,
          parcel: parcelData,
          notFound: !parcelData,
          error: null,
          branches: Array.isArray(branchData) ? branchData : [],
          couriers: Array.isArray(courierData) ? courierData : [],
        });
        if (parcelData) {
          setFormBranch(parcelData.latest_branch_id ? String(parcelData.latest_branch_id) : "");
          setFormCourier(courierSelection(parcelData));
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setLoadState((previous) => ({
          ...previous,
          key: loadKey,
          parcel: null,
          notFound: false,
          error: err.message,
        }));
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadKey, parcelId]);

  const loading = loadState.key !== loadKey;
  const parcel = loading ? null : loadState.parcel;
  const notFound = !loading && loadState.notFound;
  const error = !loading && loadState.error;
  const branches = loadState.branches;
  const couriers = loadState.couriers;

  // The complete options endpoint is intentionally unpaged and exposes the
  // allowed assignees directly; branch compatibility is enforced server-side.
  const filteredCouriers = couriers;
  // Return leg is derived from the rendered history — retry cap or a hard-fail
  // reason opens it. Mirrors the backend's return_triggered list field.
  const returnTriggered = returnTriggeredFromHistory(parcel?.tracking_history);
  const statusOptions = nextStatusesForRole(
    parcel?.current_status,
    returnTriggered,
    canUpdateAssignment,
  );
  const canLogTrackingUpdate = statusOptions.length > 0;
  const selectedStatus = statusOptions.includes(formStatus)
    ? formStatus
    : statusOptions.includes(parcel?.current_status)
      ? parcel.current_status
      : statusOptions[0] ?? "";
  // Return-leg red cue: return triggered and not yet back at the sender.
  const returning = isReturning(parcel?.current_status, returnTriggered);
  const branchLabel = formBranch
    ? (branches.find((branch) => String(branch.branch_id) === String(formBranch))?.branch_name ?? `Branch #${formBranch}`)
    : "No branch assigned";
  const courierLabel = formCourier
    ? (couriers.find((courier) => String(courier.courier_id) === String(formCourier))?.full_name ?? `Courier #${formCourier}`)
    : "No courier assigned";

  // Validation runs first so the confirm dialog never appears over a form that
  // would be rejected anyway. Only terminal statuses need confirming.
  function handleTrackingSubmit() {
    if (updating) return;
    if (!statusOptions.includes(selectedStatus)) {
      setUpdateError(`${selectedStatus || "That status"} is not a legal next step from ${parcel?.current_status ?? "the current status"}.`);
      return;
    }
    if (selectedStatus === "Cancelled" && !formRemarks.trim()) {
      setUpdateError("A cancellation reason is required.");
      return;
    }
    if (selectedStatus === "Delivery Failed" && !FAIL_REASONS.includes(formRemarks)) {
      setUpdateError("A failure reason is required.");
      return;
    }
    const receiver = parcel?.receiver?.business_name ?? "the receiver";
    if (selectedStatus === "Cancelled") {
      setConfirm({
        title: "Cancel parcel?",
        message: `Cancel parcel #${parcelId} to ${receiver} with reason "${formRemarks.trim()}"? This cannot be undone.`,
        confirmLabel: "Cancel parcel",
        onConfirm: () => { void submitTrackingUpdate(); },
      });
      return;
    }
    if (selectedStatus === "Delivery Failed") {
      setConfirm({
        title: "Record delivery failure?",
        message: `Record parcel #${parcelId} to ${receiver} as Delivery Failed with reason "${formRemarks}"? This cannot be undone.`,
        confirmLabel: "Record failure",
        onConfirm: () => { void submitTrackingUpdate(); },
      });
      return;
    }
    void submitTrackingUpdate();
  }

  async function submitTrackingUpdate() {
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
      setLoadState((previous) => ({ ...previous, parcel: data, notFound: false, error: null }));
      setFormStatus("");
      setFormBranch(data.latest_branch_id ? String(data.latest_branch_id) : "");
      setFormCourier(courierSelection(data));
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
          <LogisticsPlaceholder label={`parcel #${parcelId}`} />
        ) : notFound ? (
          <LogisticsNotice message="We couldn't find a parcel with that number." />
        ) : error ? (
          <LogisticsNotice
            message={`Could not load parcel #${parcelId}: ${error}`}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        ) : (
          <main className="parcel-wrap">
            {/* LEFT: parties, package, payment */}
            <aside className="parcel-cards">
              <div className="parcel-card route-card">
                <span className="card-heading">Origin · Sender</span>
                <span className="field-value"><strong>{parcel.sender.business_name}</strong></span>
                <span className="field-value muted">{parcel.sender.contact_number}</span>
                <span className="field-label">Origin</span>
                <span className="field-value">{addressLine(parcel.origin_address)}</span>
              </div>

              <div className="parcel-card route-card">
                <span className="card-heading">Destination · Receiver</span>
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

              <div className="parcel-route-summary">
                <div>
                  <span className="field-label">Origin</span>
                  <strong>{parcel.sender.business_name}</strong>
                  <span>{addressLine(parcel.origin_address) || "No origin address"}</span>
                </div>
                <div>
                  <span className="field-label">Destination</span>
                  <strong>{parcel.receiver.business_name}</strong>
                  <span>{addressLine(parcel.destination_address) || "No destination address"}</span>
                </div>
                {canUpdateAssignment && (
                  <div>
                    <span className="field-label">Current assignment</span>
                    <strong>{branchLabel}</strong>
                    <span>{courierLabel}</span>
                  </div>
                )}
                <p className="parcel-next-hint">Next legal status: {formatNextStatuses(statusOptions)}</p>
              </div>

              <ParcelRouteMap
                key={`${parcel.parcel_id}-${parcel.planned_route?.length ? "planned" : "empty"}`}
                stops={parcel.planned_route}
              />

              {hasAnyRole(["logistics_coordinator", "platform_admin", "courier"]) && (
                <div className="update-status-form">
                  <h3>{canUpdateAssignment ? "Assign and log the next status" : "Log the next status"}</h3>
                  <p className="form-note">
                    {canUpdateAssignment
                      ? "Only the next legal statuses are listed. Branch and courier are saved with that event."
                      : "Only the next legal status can be logged from here."}
                  </p>
                  {canLogTrackingUpdate ? (
                    <>
                      <div className="update-status-grid">
                        <label>
                          <span>Next legal status</span>
                          <select
                            value={selectedStatus}
                            onChange={e => { setFormStatus(e.target.value); setUpdateError(null); }}
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </label>

                        {canUpdateAssignment && (
                          <>
                            <label>
                              <span>Branch</span>
                              <select
                                value={formBranch}
                                onChange={e => setFormBranch(e.target.value)}
                              >
                                <option value="">No branch</option>
                                {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                              </select>
                            </label>

                            <label>
                              <span>Courier</span>
                              <select
                                value={formCourier}
                                onChange={e => setFormCourier(e.target.value)}
                              >
                                <option value="">No courier</option>
                                {filteredCouriers.map(c => (
                                  <option key={c.courier_id} value={c.courier_id}>
                                    {c.full_name}{c.active_parcel_count == null ? "" : ` · ${c.active_parcel_count} active`}
                                  </option>
                                ))}
                              </select>
                              {!parcel.latest_courier_id && parcel.suggested_courier_id && formCourier === String(parcel.suggested_courier_id) ? (
                                <span className="form-note">Suggested least-loaded courier at this branch.</span>
                              ) : null}
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

                      {updateError && <p className="form-error" role="alert">{updateError}</p>}
                      <button
                        onClick={handleTrackingSubmit}
                        disabled={updating || !selectedStatus}
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

        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AppLayout>
  );
}
