import ExpandableTableRow from "../components/ui/ExpandableTableRow";
import { useEffect, useState } from "react";
import { PackageSearch, X } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import DecisionStrip from "../components/DecisionStrip";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PaginationControls from "../components/ui/PaginationControls";
import SearchField from "../components/ui/SearchField";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useListUrlState } from "../hooks/useListUrlState";
import { usePaginatedResource } from "../hooks/usePaginatedResource";
import { apiGet, apiSend } from "../lib/api";
import { shortDate } from "../lib/format";
import { formatRoleLabel } from "../auth/roleAccess";
import { buildAdminListPath } from "./adminPagination";
import { TableSkeleton } from "../components/ui/pageSkeletons";
import "./AdminDashboardPage.css";

const USER_KINDS = [
  { value: "logistics_coordinator", label: "Logistics Coordinator" },
  { value: "courier", label: "Courier" },
  { value: "platform_admin", label: "Platform Admin" },
];

const EMPTY_FORM = {
  full_name: "", email: "", password: "", kind: "logistics_coordinator",
  business_id: "", phone_number: "", vehicle_type: "", assigned_branch_id: "",
};

// Terminal parcel statuses that cannot be cancelled. Mirrors
// backend/src/routes/admin.js TERMINAL_PARCEL_STATUSES.
const TERMINAL_STATUSES = ["Delivered", "Returned", "Cancelled"];

// Presets for the parcel-outcomes period selector (issue #79 AC-1). "all"
// sends no date params and is the default so seeded data reconciles.
const OUTCOME_PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function outcomePeriodRange(preset) {
  if (preset === "all") return {};
  const to = new Date();
  let from;
  if (preset === "today") {
    from = new Date();
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date(to.getTime() - (preset === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function membershipSummary(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) return "-";
  return memberships.map((membership) => `${membership.business_name ?? "Business"} (${formatRoleLabel(membership.role)})`).join(", ");
}

function memberSummary(members) {
  if (!Array.isArray(members) || members.length === 0) return "-";
  return members.map((member) => `${member.full_name ?? member.email ?? "Member"} (${formatRoleLabel(member.role)})`).join(", ");
}

function EmptyList({ query, label, onClear }) {
  return (
    <div className="page-empty">
      <p>{query ? `No ${label} match your search.` : `No ${label} yet.`}</p>
      {query ? <button type="button" className="admin-action-btn" onClick={onClear}>Clear search</button> : null}
    </div>
  );
}

function useDebouncedListSearch({ q, setQuery }) {
  const [value, setValue] = useState(q);
  const debouncedValue = useDebouncedValue(value, 300);

  useEffect(() => {
    // URL navigation (reload/back/forward) is the source of truth.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(q);
  }, [q]);

  useEffect(() => {
    if (debouncedValue !== q) setQuery(debouncedValue);
  }, [debouncedValue, q, setQuery]);

  return { value, setValue, submit: () => setQuery(value), clear: () => { setValue(""); setQuery(""); } };
}

function useClampListPage({ page, setPage }, pagination) {
  useEffect(() => {
    if (!pagination) return;
    const totalPages = pagination.total_pages ?? 0;
    const target = totalPages > 0 ? Math.min(page, totalPages) : 1;
    if (target !== page) setPage(target);
  }, [page, pagination, setPage]);
}

function useVisibleRows(resource) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (resource.data) {
      // Preserve the last fulfilled page while a new page is requested.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(resource.items);
    }
  }, [resource.data, resource.items]);

  return rows;
}

// Parcel lookup + cancel flow for admins, rendered as a floating panel.
// States: "idle" (lookup input) -> "loading" -> "error"/"notFound"/"review" -> "cancelling" -> "success"
function ParcelCancelFlow({ onClose }) {
  const [phase, setPhase] = useState("idle");
  const [parcelId, setParcelId] = useState("");
  const [parcel, setParcel] = useState(null);
  const [error, setError] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  const addressLine = (a) =>
    a && [a.street_address, a.barangay, a.city_municipality, a.province, a.postal_code].filter(Boolean).join(", ");

  async function handleLookup(event) {
    event.preventDefault();
    const id = parcelId.trim();
    if (!id) return;
    setPhase("loading");
    setError(null);
    setParcel(null);
    try {
      const data = await apiGet(`/api/parcels/${encodeURIComponent(id)}`);
      if (!data) {
        setPhase("notFound");
      } else {
        setParcel(data);
        setPhase("review");
      }
    } catch (err) {
      if (err?.status === 404) {
        setPhase("notFound");
      } else {
        setError(err.message);
        setPhase("error");
      }
    }
  }

  function handleRetry() {
    setPhase("idle");
  }

  function handleWrongParcel() {
    setParcelId("");
    setParcel(null);
    setPhase("idle");
  }

  async function handleCancelSubmit(event) {
    event.preventDefault();
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Cancellation reason is required.");
      return;
    }
    if (parcel && TERMINAL_STATUSES.includes(parcel.current_status)) {
      setCancelError(`Cannot cancel — parcel is already ${parcel.current_status.toLowerCase()}.`);
      return;
    }
    setCancelError(null);
    setCancelBusy(true);
    try {
      await apiSend(`/api/parcels/${encodeURIComponent(parcel.parcel_id)}/tracking`, {
        method: "POST",
        body: { status_update: "Cancelled", remarks: reason },
      });
      setCancelSuccess(`Parcel ${parcel.parcel_id} cancelled.`);
      setCancelReason("");
      setParcelId("");
      setParcel(null);
      setPhase("success");
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelBusy(false);
    }
  }

  function handleSuccessDismiss() {
    setCancelSuccess(null);
    onClose();
  }

  // Phase rendering
  if (phase === "idle") {
    return (
      <form onSubmit={handleLookup} className="parcel-lookup-form" aria-label="Look up a parcel">
        <div className="admin-form-grid">
          <label>
            <span>Parcel ID</span>
            <input
              type="text"
              value={parcelId}
              onChange={(e) => setParcelId(e.target.value)}
              placeholder="LKO-00000001"
              required
              autoFocus
            />
          </label>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-primary-btn">Look up parcel</button>
        </div>
      </form>
    );
  }

  if (phase === "loading") {
    return (
      <div className="parcel-lookup-loading" role="status">
        <div className="spinner" aria-hidden="true" />
        <p>Looking up parcel…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="parcel-lookup-error">
        <p className="admin-form-error">Could not load parcel: {error}</p>
        <div className="admin-form-actions">
          <button type="button" className="admin-action-btn" onClick={handleRetry}>Try again</button>
        </div>
      </div>
    );
  }

  if (phase === "notFound") {
    return (
      <div className="parcel-lookup-error">
        <p className="admin-form-error">Parcel not found or you don't have access.</p>
        <div className="admin-form-actions">
          <button type="button" className="admin-action-btn" onClick={handleRetry}>Try another ID</button>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    const p = parcel;
    const currentStatus = p.current_status ?? "Unknown";
    const senderName = p.sender?.business_name ?? "—";
    const receiverName = p.receiver?.business_name ?? "—";
    const tierName = p.tier?.tier_name ?? "—";
    const weight = p.weight_kg != null ? `${p.weight_kg} kg` : "—";
    const trackingCount = Array.isArray(p.tracking_history) ? p.tracking_history.length : 0;
    const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

    return (
      <div className="parcel-review-card">
        <h4>Confirm parcel details</h4>
        {isTerminal && (
          <div className="admin-form-error" style={{ marginBottom: 12 }}>
            Cannot cancel — parcel is already {currentStatus.toLowerCase()}.
          </div>
        )}
        <dl className="parcel-review-grid">
          <dt>Parcel ID</dt>
          <dd><strong>{p.parcel_id}</strong></dd>
          <dt>Current status</dt>
          <dd><span className="status">{currentStatus}</span></dd>
          <dt>Sender</dt>
          <dd>{senderName}</dd>
          <dt>Receiver</dt>
          <dd>{receiverName}</dd>
          <dt>Origin</dt>
          <dd>{addressLine(p.origin_address) || "—"}</dd>
          <dt>Destination</dt>
          <dd>{addressLine(p.destination_address) || "—"}</dd>
          <dt>Service tier</dt>
          <dd>{tierName}</dd>
          <dt>Weight</dt>
          <dd>{weight}</dd>
          <dt>Tracking events</dt>
          <dd>{trackingCount}</dd>
        </dl>
        <div className="admin-form-actions">
          <button type="button" className="admin-action-btn" onClick={handleWrongParcel}>Wrong parcel</button>
          <button
            type="button"
            className="admin-primary-btn"
            disabled={isTerminal}
            onClick={() => setPhase("cancelling")}
          >
            {isTerminal ? "Cannot cancel" : "Continue to cancel"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "cancelling") {
    return (
      <form onSubmit={handleCancelSubmit} className="parcel-cancel-form">
        <p className="cancel-confirm-text">Cancelling <strong>{parcel.parcel_id}</strong> — {parcel.sender?.business_name} → {parcel.receiver?.business_name}</p>
        <div className="admin-form-grid">
          <label>
            <span>Cancellation reason</span>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Customer request"
              required
              autoFocus
            />
          </label>
        </div>
        <div className="admin-form-actions">
          {cancelError && <span className="admin-form-error">{cancelError}</span>}
          <button type="button" className="admin-action-btn" onClick={() => setPhase("review")}>Back</button>
          <button type="submit" className="admin-primary-btn" disabled={cancelBusy}>
            {cancelBusy ? "Cancelling…" : "Cancel parcel"}
          </button>
        </div>
      </form>
    );
  }

  if (phase === "success") {
    return (
      <div className="parcel-cancel-success">
        <p className="admin-form-success">{cancelSuccess}</p>
        <div className="admin-form-actions">
          <button type="button" className="admin-primary-btn" onClick={handleSuccessDismiss}>Done</button>
        </div>
      </div>
    );
  }

  return null;
}

function ParcelCancelPanel({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="admin-floating-panel-backdrop" onClick={onClose}>
      <section
        className="admin-floating-panel parcel-cancel-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-parcel-cancel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-floating-panel-head">
          <div>
            <p className="admin-floating-eyebrow">Customer service</p>
            <h2 id="admin-parcel-cancel-title">Parcel lookup &amp; cancel</h2>
          </div>
          <button type="button" className="admin-panel-close" aria-label="Close parcel lookup and cancel" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <ParcelCancelFlow onClose={onClose} />
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const usersList = useListUrlState({ prefix: "users" });
  const businessesList = useListUrlState({ prefix: "businesses" });
  const usersSearch = useDebouncedListSearch(usersList);
  const businessesSearch = useDebouncedListSearch(businessesList);
  const usersResource = usePaginatedResource(buildAdminListPath("/api/admin/users", usersList));
  const businessesResource = usePaginatedResource(buildAdminListPath("/api/admin/businesses", businessesList));
  const [businessOptions, setBusinessOptions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [optionsError, setOptionsError] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [operations, setOperations] = useState(null);
  const [operationsError, setOperationsError] = useState(null);
  const [parcelCancelOpen, setParcelCancelOpen] = useState(false);
  const [outcomePeriod, setOutcomePeriod] = useState("all");
  const [outcomeState, setOutcomeState] = useState({ data: null, error: null, key: "all" });
  const [stuck, setStuck] = useState({ count: null, error: null, loading: true });
  // A period change starts a new request; the previous period's data is held
  // back (loading) until its own response arrives, so numbers never mix.
  const outcomes = {
    data: outcomeState.key === outcomePeriod ? outcomeState.data : null,
    error: outcomeState.key === outcomePeriod ? outcomeState.error : null,
    loading: outcomeState.key !== outcomePeriod,
  };

  const visibleUsers = useVisibleRows(usersResource);
  const visibleBusinesses = useVisibleRows(businessesResource);

  useClampListPage(usersList, usersResource.pagination);
  useClampListPage(businessesList, businessesResource.pagination);

  useEffect(() => {
    const controller = new AbortController();
    apiGet("/api/admin/operations", { signal: controller.signal })
      .then((data) => {
        setOperations(data);
        setOperationsError(null);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setOperationsError(error.message);
      });
    return () => controller.abort();
  }, []);

  // Period-scoped outcomes (return rate / Delivery Failed) for AC-1. The
  // period is recomputed per request so "Today" stays live.
  useEffect(() => {
    const controller = new AbortController();
    const key = outcomePeriod;
    const params = new URLSearchParams(outcomePeriodRange(outcomePeriod));
    const qs = params.toString();
    apiGet(`/api/admin/parcel-outcomes${qs ? `?${qs}` : ""}`, { signal: controller.signal })
      .then((data) => setOutcomeState({ data, error: null, key }))
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setOutcomeState((previous) => ({ data: previous.data, error, key }));
        }
      });
    return () => controller.abort();
  }, [outcomePeriod]);

  // Stuck count reads the same server filter the deep link opens, so the
  // flag and the filtered list can never diverge (AC-2/AC-3).
  useEffect(() => {
    const controller = new AbortController();
    apiGet("/api/parcels?stuck=true&limit=10", { signal: controller.signal })
      .then((data) => setStuck({ count: data?.pagination?.total_items ?? 0, error: null, loading: false }))
      .catch((error) => {
        if (error?.name !== "AbortError") setStuck({ count: null, error, loading: false });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet("/api/admin/businesses/options?type=logistics", { signal: controller.signal }),
      apiGet("/api/branches/options", { signal: controller.signal }),
    ]).then(([businessData, branchData]) => {
      setBusinessOptions(Array.isArray(businessData) ? businessData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setOptionsError(null);
    }).catch((error) => {
      if (error?.name !== "AbortError") setOptionsError(error.message);
    });
    return () => controller.abort();
  }, []);

  function requestToggleUserActive(entry) {
    const nextActive = !entry.is_active;
    if (nextActive) { void toggleUserActive(entry.user_id, true); return; }
    setConfirm({
      title: "Deactivate user?",
      message: `Deactivate ${entry.full_name ?? entry.email}? They will lose access to LINKO until an admin reactivates the account.`,
      confirmLabel: "Deactivate user",
      onConfirm: () => { void toggleUserActive(entry.user_id, false); },
    });
  }

  function requestToggleBusinessVerified(business) {
    const nextVerified = !business.is_verified;
    if (nextVerified) { void toggleBusinessVerified(business.business_id, true); return; }
    setConfirm({
      title: "Remove verification?",
      message: `Unverify ${business.business_name}? The business loses its verified badge until an admin verifies it again.`,
      confirmLabel: "Unverify business",
      onConfirm: () => { void toggleBusinessVerified(business.business_id, false); },
    });
  }

  async function toggleUserActive(userId, nextActive) {
    setMutatingId(`user-${userId}`); setFormError(null);
    try {
      await apiSend(`/api/admin/users/${userId}`, { method: "PATCH", body: { is_active: nextActive } });
      usersResource.reload();
    } catch (error) { setFormError(error.message); } finally { setMutatingId(null); }
  }

  async function toggleBusinessVerified(businessId, nextVerified) {
    setMutatingId(`business-${businessId}`); setFormError(null);
    try {
      await apiSend(`/api/admin/businesses/${businessId}`, { method: "PATCH", body: { is_verified: nextVerified } });
      businessesResource.reload();
    } catch (error) { setFormError(error.message); } finally { setMutatingId(null); }
  }

  function updateForm(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function submitCreate(event) {
    event.preventDefault(); setFormError(null);
    const fullName = form.full_name.trim(); const email = form.email.trim();
    if (!fullName || !email || !form.password) { setFormError("Full name, email, and password are required."); return; }
    if (form.kind === "logistics_coordinator" && !form.business_id) { setFormError("Select a business for this role."); return; }
    const body = { full_name: fullName, email, password: form.password, kind: form.kind };
    if (form.kind === "logistics_coordinator") body.business_id = Number(form.business_id);
    if (form.kind === "courier") {
      if (form.phone_number.trim()) body.phone_number = form.phone_number.trim();
      if (form.vehicle_type.trim()) body.vehicle_type = form.vehicle_type.trim();
      if (form.assigned_branch_id) body.assigned_branch_id = Number(form.assigned_branch_id);
    }
    setCreating(true);
    try { await apiSend("/api/admin/users", { method: "POST", body }); setForm(EMPTY_FORM); usersResource.reload(); }
    catch (error) { setFormError(error.message); } finally { setCreating(false); }
  }

  const usersPagination = usersResource.pagination ?? { page: usersList.page, limit: usersList.limit, total_items: 0, total_pages: 0 };
  const businessesPagination = businessesResource.pagination ?? { page: businessesList.page, limit: businessesList.limit, total_items: 0, total_pages: 0 };

  return (
    <AppLayout>
      <div className="admin-page">
        <div className="page-head"><h1>Admin</h1></div>
        <DecisionStrip
          label="Operations that need an admin decision"
          loading={!operations && !operationsError}
          error={operationsError}
          items={[
            { key: "pending", to: "/orders?status=Pending", value: operations?.openOrders?.pending, label: "Pending orders", hint: "Accept, reject, or follow up", empty: "No pending orders" },
            { key: "accepted", to: "/orders?status=Accepted", value: operations?.openOrders?.accepted, label: "Accepted orders", hint: "Confirm they move into preparation", empty: "No accepted orders" },
            { key: "preparing", to: "/orders?status=Preparing", value: operations?.openOrders?.preparing, label: "Preparing orders", hint: "Watch for stalls before shipment", empty: "No orders being prepared" },
            { key: "shipped", to: "/orders?status=Shipped", value: operations?.openOrders?.shipped, label: "Shipped orders", hint: "Track parcels still in transit", empty: "No shipped orders in transit" },
            { key: "parcels", to: "/logistics?assignment=available", value: operations?.unassignedOrBranchlessParcels, label: "Unassigned parcels", hint: "Open the assignment filter and assign a courier", empty: "No parcels waiting for assignment" },
            { key: "stock", to: "/inventory?stock=low", value: operations?.lowStockProducts, label: "Low-stock products", hint: "Restock before buyers hit an empty shelf", empty: "No products are low on stock" },
            { key: "couriers", to: "/logistics/management", value: operations?.activeCouriers, label: "Active couriers", hint: "Check who can take the next delivery", empty: "No active couriers" },
          ]}
        />
        <section className="admin-section">
          <div className="admin-section-head admin-outcomes-head">
            <h2>Parcel outcomes</h2>
            <label className="admin-period-select">
              <span>Period</span>
              <select value={outcomePeriod} onChange={(event) => setOutcomePeriod(event.target.value)}>
                {OUTCOME_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>{period.label}</option>
                ))}
              </select>
            </label>
          </div>
          <DecisionStrip
            label="Parcel outcomes"
            loading={outcomes.loading || stuck.loading}
            error={outcomes.error?.message ?? stuck.error?.message ?? null}
            items={[
              {
                key: "returnRate",
                to: "/logistics?status=Returned",
                value: outcomes.data && outcomes.data.total > 0
                  ? Math.round((outcomes.data.returned / outcomes.data.total) * 100)
                  : 0,
                label: outcomes.data && outcomes.data.total > 0
                  ? `Return rate — ${outcomes.data.returned} of ${outcomes.data.total} parcels returned`
                  : "Return rate — no parcels booked in this period",
              },
              {
                key: "deliveryFailed",
                to: "/logistics?status=Delivery%20Failed",
                value: outcomes.data?.deliveryFailed,
                label: "Delivery Failed parcels",
              },
              {
                key: "stuck",
                to: "/logistics?stuck=true",
                value: stuck.count,
                label: "Stuck parcels (no scan 2+ days)",
              },
            ]}
          />
        </section>
        {optionsError ? <div className="page-empty admin-error">Could not load form options: {optionsError}</div> : null}
        <section className="admin-section">
          <div className="admin-section-head"><h2>Customer Service Tools</h2></div>
          <div className="cs-tools-grid">
            <div className="admin-create-form">
              <h3 className="cs-tool-title">Parcel lookup &amp; cancel</h3>
              <p className="cs-tool-text">Look up a parcel, confirm the sender and receiver, then cancel it with a reason.</p>
              <div className="admin-form-actions admin-tool-actions">
                <button type="button" className="admin-primary-btn" onClick={() => setParcelCancelOpen(true)}>
                  <PackageSearch size={16} aria-hidden="true" /> Open lookup &amp; cancel
                </button>
              </div>
            </div>
            <div className="admin-create-form">
              <h3 className="cs-tool-title">Logistics</h3>
              <p className="cs-tool-text">Open the parcel list, unassigned queue, courier load, or logistics management.</p>
              <div className="cs-tool-links">
                <Link to="/logistics">Parcel list</Link>
                <Link to="/logistics?assignment=available">Unassigned parcels</Link>
                <Link to="/logistics/management">Logistics management</Link>
              </div>
            </div>
          </div>
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><h2>Users</h2></div>
          <form className="admin-create-form" onSubmit={submitCreate}><div className="admin-form-grid">
            <label><span>Full name</span><input type="text" value={form.full_name} onChange={(event) => updateForm("full_name", event.target.value)} placeholder="Jane Dela Cruz" /></label><label><span>Email</span><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="user@linko.test" /></label><label><span>Password</span><input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder="Temporary password" /></label><label><span>Role</span><select value={form.kind} onChange={(event) => updateForm("kind", event.target.value)}>{USER_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
            {form.kind === "logistics_coordinator" ? <label><span>Business</span><select value={form.business_id} onChange={(event) => updateForm("business_id", event.target.value)}><option value="">Select a business…</option>{businessOptions.map((business) => <option key={business.business_id} value={business.business_id}>{business.business_name}</option>)}</select></label> : null}
            {form.kind === "courier" ? <><label><span>Phone</span><input type="text" value={form.phone_number} onChange={(event) => updateForm("phone_number", event.target.value)} placeholder="+639170000000" /></label><label><span>Vehicle</span><input type="text" value={form.vehicle_type} onChange={(event) => updateForm("vehicle_type", event.target.value)} placeholder="Motorcycle" /></label><label><span>Branch</span><select value={form.assigned_branch_id} onChange={(event) => updateForm("assigned_branch_id", event.target.value)}><option value="">No branch</option>{branches.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}</select></label></> : null}
          </div><div className="admin-form-actions">{formError ? <span className="admin-form-error">{formError}</span> : null}<button type="submit" className="admin-primary-btn" disabled={creating}>{creating ? "Creating…" : "Create user"}</button></div></form>
          <SearchField value={usersSearch.value} onChange={usersSearch.setValue} onSubmit={usersSearch.submit} onClear={usersSearch.clear} label="Search users" placeholder="Name, email, business, or role" />
          {usersResource.error ? <div className="page-empty admin-error">Could not load users: {usersResource.error.message}</div> : null}
          <div className="table-card" aria-busy={usersResource.loading}>
            {!usersResource.data && usersResource.loading && visibleUsers.length === 0 ? (
              <TableSkeleton columns={4} rows={6} label="Loading users" />
            ) : visibleUsers.length === 0 ? (
              <EmptyList query={usersList.q} label="users" onClear={usersSearch.clear} />
            ) : (
              <table className="data-table admin-compact-table">
                <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col" className="table-status">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>{visibleUsers.map((entry) => {
                  const busy = mutatingId === `user-${entry.user_id}`;
                  return (
                    <ExpandableTableRow
                      key={entry.user_id}
                      label={entry.full_name ?? entry.email}
                      cells={[
                        { key: "user", content: <>{entry.full_name ?? entry.email}<small>{entry.email}</small></> },
                        { key: "role", content: entry.global_role ? formatRoleLabel(entry.global_role) : "-" },
                        { key: "status", content: <span className={`status ${entry.is_active ? "notified" : "cancelled"}`}>{entry.is_active ? "Active" : "Inactive"}</span> },
                        { key: "actions", content: <button type="button" className="admin-action-btn" disabled={busy} onClick={() => requestToggleUserActive(entry)}>{busy ? "Updating…" : entry.is_active ? "Deactivate" : "Reactivate"}</button> },
                      ]}
                    >
                      <dl>
                        <div><dt>Memberships</dt><dd>{membershipSummary(entry.memberships)}</dd></div>
                        <div><dt>Created</dt><dd>{shortDate(entry.created_at)}</dd></div>
                      </dl>
                    </ExpandableTableRow>
                  );
                })}</tbody>
              </table>
            )}
          </div>
          <PaginationControls pagination={usersPagination} onPageChange={usersList.setPage} onLimitChange={usersList.setLimit} disabled={usersResource.loading} ariaLabel="Users pagination" />
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><h2>Businesses</h2></div>
          <SearchField value={businessesSearch.value} onChange={businessesSearch.setValue} onSubmit={businessesSearch.submit} onClear={businessesSearch.clear} label="Search businesses" placeholder="Name, type, or member" />
          {businessesResource.error ? <div className="page-empty admin-error">Could not load businesses: {businessesResource.error.message}</div> : null}
          <div className="table-card" aria-busy={businessesResource.loading}>
            {!businessesResource.data && businessesResource.loading && visibleBusinesses.length === 0 ? (
              <TableSkeleton columns={4} rows={6} label="Loading businesses" />
            ) : visibleBusinesses.length === 0 ? (
              <EmptyList query={businessesList.q} label="businesses" onClear={businessesSearch.clear} />
            ) : (
              <table className="data-table admin-compact-table">
                <thead><tr><th scope="col">Business</th><th scope="col">Type</th><th scope="col" className="table-status">Status</th><th scope="col">Actions</th></tr></thead>
                <tbody>{visibleBusinesses.map((business) => {
                  const busy = mutatingId === `business-${business.business_id}`;
                  return (
                    <ExpandableTableRow
                      key={business.business_id}
                      label={business.business_name}
                      cells={[
                        { key: "business", content: business.business_name },
                        { key: "type", content: business.business_type ?? "-" },
                        { key: "status", content: <span className={`status ${business.is_verified ? "notified" : "waiting"}`}>{business.is_verified ? "Verified" : "Unverified"}</span> },
                        { key: "actions", content: <button type="button" className="admin-action-btn" disabled={busy} onClick={() => requestToggleBusinessVerified(business)}>{busy ? "Updating…" : business.is_verified ? "Unverify" : "Verify"}</button> },
                      ]}
                    >
                      <dl>
                        <div><dt>Members</dt><dd>{memberSummary(business.members)}</dd></div>
                        <div><dt>Created</dt><dd>{shortDate(business.created_at)}</dd></div>
                      </dl>
                    </ExpandableTableRow>
                  );
                })}</tbody>
              </table>
            )}
          </div>
          <PaginationControls pagination={businessesPagination} onPageChange={businessesList.setPage} onLimitChange={businessesList.setLimit} disabled={businessesResource.loading} ariaLabel="Businesses pagination" />
        </section>
        <ParcelCancelPanel open={parcelCancelOpen} onClose={() => setParcelCancelOpen(false)} />
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
