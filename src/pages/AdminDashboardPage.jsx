import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
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

function membershipSummary(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) return "—";
  return memberships.map((membership) => `${membership.business_name ?? "Business"} (${formatRoleLabel(membership.role)})`).join(", ");
}

function memberSummary(members) {
  if (!Array.isArray(members) || members.length === 0) return "—";
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

export default function AdminDashboardPage() {
  const navigate = useNavigate();
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
  const [lookupId, setLookupId] = useState("");
  const [cancelId, setCancelId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const visibleUsers = useVisibleRows(usersResource);
  const visibleBusinesses = useVisibleRows(businessesResource);

  useClampListPage(usersList, usersResource.pagination);
  useClampListPage(businessesList, businessesResource.pagination);

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

  function submitLookup(event) {
    event.preventDefault();
    if (lookupId.trim()) navigate(`/logistics/${lookupId.trim()}`);
  }

  function submitCancel(event) {
    event.preventDefault();
    setCancelError(null); setCancelSuccess(null);
    const id = cancelId.trim(); const reason = cancelReason.trim();
    if (!id || !reason) { setCancelError("Parcel ID and reason are required."); return; }
    setConfirm({
      title: "Cancel parcel?",
      message: `Cancel parcel ${id} with reason "${reason}"? This logs a Cancelled tracking event and cannot be undone.`,
      confirmLabel: "Cancel parcel",
      onConfirm: () => { void runCancel(id, reason); },
    });
  }

  async function runCancel(id, reason) {
    setCancelBusy(true);
    try {
      await apiSend(`/api/parcels/${id}/tracking`, { method: "POST", body: { status_update: "Cancelled", remarks: reason } });
      setCancelSuccess(`Parcel ${id} cancelled.`); setCancelId(""); setCancelReason("");
    } catch (error) { setCancelError(error.message); } finally { setCancelBusy(false); }
  }

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
        {optionsError ? <div className="page-empty admin-error">Could not load form options: {optionsError}</div> : null}
        <section className="admin-section">
          <div className="admin-section-head"><h2>Customer Service Tools</h2></div>
          <div className="cs-tools-grid">
            <div className="admin-create-form"><h3 className="cs-tool-title">Parcel lookup</h3><form onSubmit={submitLookup}><div className="admin-form-grid"><label><span>Parcel ID</span><input type="text" value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="LKO-00000001" /></label></div><div className="admin-form-actions"><button type="submit" className="admin-primary-btn">Open parcel</button></div></form></div>
            <div className="admin-create-form"><h3 className="cs-tool-title">Quick Cancel</h3><form onSubmit={submitCancel}><div className="admin-form-grid"><label><span>Parcel ID</span><input type="text" value={cancelId} onChange={(event) => setCancelId(event.target.value)} placeholder="LKO-00000001" /></label><label><span>Reason</span><input type="text" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Customer request" /></label></div><div className="admin-form-actions">{cancelError ? <span className="admin-form-error">{cancelError}</span> : null}{cancelSuccess ? <span className="admin-form-success">{cancelSuccess}</span> : null}<button type="submit" className="admin-primary-btn" disabled={cancelBusy}>{cancelBusy ? "Cancelling…" : "Cancel parcel"}</button></div></form></div>
            <div className="admin-create-form"><h3 className="cs-tool-title">Reassign courier</h3><p className="cs-tool-text">Courier reassignment is logged with a delivery event — open the parcel and use Log Delivery Event.</p><div className="cs-tool-links"><Link to="/logistics">Parcel list</Link><Link to="/logistics/management">Logistics management</Link></div></div>
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
          <div className="table-card" aria-busy={usersResource.loading}>{!usersResource.data && usersResource.loading && visibleUsers.length === 0 ? <div className="page-empty">Loading users…</div> : visibleUsers.length === 0 ? <EmptyList query={usersList.q} label="users" onClear={usersSearch.clear} /> : <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Global Role</th><th>Memberships</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleUsers.map((entry) => { const busy = mutatingId === `user-${entry.user_id}`; return <tr key={entry.user_id}><td><strong>{entry.full_name ?? "—"}</strong></td><td>{entry.email}</td><td>{entry.global_role ? formatRoleLabel(entry.global_role) : "—"}</td><td className="admin-memberships">{membershipSummary(entry.memberships)}</td><td><span className={`status ${entry.is_active ? "notified" : "cancelled"}`}>{entry.is_active ? "Active" : "Inactive"}</span></td><td>{shortDate(entry.created_at)}</td><td><button type="button" className="admin-action-btn" disabled={busy} onClick={() => requestToggleUserActive(entry)}>{busy ? "Updating…" : entry.is_active ? "Deactivate" : "Reactivate"}</button></td></tr>; })}</tbody></table>}</div>
          <PaginationControls pagination={usersPagination} onPageChange={usersList.setPage} onLimitChange={usersList.setLimit} disabled={usersResource.loading} ariaLabel="Users pagination" />
        </section>
        <section className="admin-section">
          <div className="admin-section-head"><h2>Businesses</h2></div>
          <SearchField value={businessesSearch.value} onChange={businessesSearch.setValue} onSubmit={businessesSearch.submit} onClear={businessesSearch.clear} label="Search businesses" placeholder="Name, type, or member" />
          {businessesResource.error ? <div className="page-empty admin-error">Could not load businesses: {businessesResource.error.message}</div> : null}
          <div className="table-card" aria-busy={businessesResource.loading}>{!businessesResource.data && businessesResource.loading && visibleBusinesses.length === 0 ? <div className="page-empty">Loading businesses…</div> : visibleBusinesses.length === 0 ? <EmptyList query={businessesList.q} label="businesses" onClear={businessesSearch.clear} /> : <table className="data-table"><thead><tr><th>Name</th><th>Type</th><th>Members</th><th>Verified</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleBusinesses.map((business) => { const busy = mutatingId === `business-${business.business_id}`; return <tr key={business.business_id}><td><strong>{business.business_name}</strong></td><td>{business.business_type ?? "—"}</td><td className="admin-memberships">{memberSummary(business.members)}</td><td><span className={`status ${business.is_verified ? "notified" : "waiting"}`}>{business.is_verified ? "Verified" : "Unverified"}</span></td><td>{shortDate(business.created_at)}</td><td><button type="button" className="admin-action-btn" disabled={busy} onClick={() => requestToggleBusinessVerified(business)}>{busy ? "Updating…" : business.is_verified ? "Unverify" : "Verify"}</button></td></tr>; })}</tbody></table>}</div>
          <PaginationControls pagination={businessesPagination} onPageChange={businessesList.setPage} onLimitChange={businessesList.setLimit} disabled={businessesResource.loading} ariaLabel="Businesses pagination" />
        </section>
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
