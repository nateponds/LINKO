import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import AppLayout from "../../layouts/AppLayout";
import MapPicker from "../../components/ui/MapPicker";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PaginationControls from "../../components/ui/PaginationControls";
import SearchField from "../../components/ui/SearchField";
import { useAuth } from "../../auth/AuthProvider";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useListUrlState } from "../../hooks/useListUrlState";
import { usePaginatedResource } from "../../hooks/usePaginatedResource";
import { apiGet, apiSend } from "../../lib/api";
import { buildLogisticsListPath } from "./logisticsPagination";
import { LogisticsNotice, LogisticsPlaceholder } from "./LogisticsStates";
import "./LogisticsManagementPage.css";

const EMPTY_BRANCH = { branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: "" };
const EMPTY_COURIER = { phone_number: "", vehicle_type: "", assigned_branch_id: "" };
const EMPTY_TIER = { tier_name: "", base_fee: "", base_rate_per_kg: "", rate_per_km: "", estimated_days: "" };

function trimmed(value) {
  return String(value ?? "").trim();
}

function branchProblems(form, { coordinates = false } = {}) {
  const problems = [];
  if (!trimmed(form.branch_name)) problems.push("Branch name is required.");
  if (!trimmed(form.contact_number)) problems.push("Contact number is required.");
  if (!trimmed(form.province)) problems.push("Province is required.");
  if (!trimmed(form.city_municipality)) problems.push("City or municipality is required.");
  if (coordinates) {
    const lat = trimmed(form.latitude);
    const lng = trimmed(form.longitude);
    if ((lat === "") !== (lng === "")) problems.push("Provide both latitude and longitude, or neither.");
  }
  return problems;
}

function courierProblems(form) {
  const problems = [];
  if (!trimmed(form.phone_number)) problems.push("Phone number is required.");
  if (!trimmed(form.vehicle_type)) problems.push("Vehicle type is required.");
  return problems;
}

function problemText(problems) {
  return problems.join(" ");
}

function useDebouncedListSearch({ q, setQuery }) {
  const [value, setValue] = useState(q);
  const debouncedValue = useDebouncedValue(value, 300);
  useEffect(() => {
    // URL navigation (reload/back/forward) remains authoritative.
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
      // Keep the fulfilled page on screen until a replacement arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(resource.items);
    }
  }, [resource.data, resource.items]);
  return rows;
}

function ListState({ resource, items, query, label, onClear, onRetry, children }) {
  if (!resource.data && resource.loading && items.length === 0) return <LogisticsPlaceholder label={label} />;
  if (resource.error && items.length === 0) {
    return <LogisticsNotice message={`Could not load ${label}: ${resource.error.message}`} onRetry={onRetry} />;
  }
  if (items.length === 0) {
    return (
      <LogisticsNotice
        message={query ? `No ${label} match your search.` : `No ${label} yet.`}
        onRetry={query ? onClear : undefined}
        retryLabel="Clear search"
      />
    );
  }
  return children;
}

function BranchFields({ form, onChange, invalid }) {
  return (
    <>
      <input aria-label="Branch name" aria-invalid={invalid} placeholder="Branch name" required value={form.branch_name} onChange={(event) => onChange({ branch_name: event.target.value })} />
      <input aria-label="Contact number" aria-invalid={invalid} placeholder="Contact number" required value={form.contact_number} onChange={(event) => onChange({ contact_number: event.target.value })} />
      <input aria-label="Province" aria-invalid={invalid} placeholder="Province" required value={form.province} onChange={(event) => onChange({ province: event.target.value })} />
      <input aria-label="City or municipality" aria-invalid={invalid} placeholder="City or municipality" required value={form.city_municipality} onChange={(event) => onChange({ city_municipality: event.target.value })} />
      <input aria-label="Barangay" placeholder="Barangay" value={form.barangay} onChange={(event) => onChange({ barangay: event.target.value })} />
      <input aria-label="Street address" placeholder="Street address" value={form.street_address} onChange={(event) => onChange({ street_address: event.target.value })} />
      <input aria-label="Postal code" placeholder="Postal code" value={form.postal_code} onChange={(event) => onChange({ postal_code: event.target.value })} />
    </>
  );
}

export default function LogisticsManagementPage() {
  const { user } = useAuth();
  const branchesList = useListUrlState({ prefix: "branches" });
  const couriersList = useListUrlState({ prefix: "couriers" });
  const branchesSearch = useDebouncedListSearch(branchesList);
  const couriersSearch = useDebouncedListSearch(couriersList);
  const branchesResource = usePaginatedResource(buildLogisticsListPath("/api/branches", branchesList));
  const couriersResource = usePaginatedResource(buildLogisticsListPath("/api/couriers", couriersList));
  const visibleBranches = useVisibleRows(branchesResource);
  const visibleCouriers = useVisibleRows(couriersResource);
  const [branchOptions, setBranchOptions] = useState([]);
  const [optionsError, setOptionsError] = useState(null);
  const [serviceTiers, setServiceTiers] = useState([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [tierLoadError, setTierLoadError] = useState(null);
  const [tierFormError, setTierFormError] = useState(null);
  const [newBranch, setNewBranch] = useState(EMPTY_BRANCH);
  const [branchError, setBranchError] = useState(null);
  const [branchErrorScope, setBranchErrorScope] = useState(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [branchForm, setBranchForm] = useState({ ...EMPTY_BRANCH, latitude: "", longitude: "" });
  const [togglingBranchId, setTogglingBranchId] = useState(null);
  const [courierError, setCourierError] = useState(null);
  const [courierErrorScope, setCourierErrorScope] = useState(null);
  const [submittingCourier, setSubmittingCourier] = useState(false);
  const [editingCourierId, setEditingCourierId] = useState(null);
  const [courierForm, setCourierForm] = useState(EMPTY_COURIER);
  const [editingTierId, setEditingTierId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_TIER);
  const [submittingTier, setSubmittingTier] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useClampListPage(branchesList, branchesResource.pagination);
  useClampListPage(couriersList, couriersResource.pagination);

  function reportBranchError(scope, message) {
    setBranchError(message);
    setBranchErrorScope(scope);
  }

  function reportCourierError(scope, message) {
    setCourierError(message);
    setCourierErrorScope(scope);
  }

  async function reloadBranchOptions() {
    try {
      const data = await apiGet("/api/branches/options");
      setBranchOptions(Array.isArray(data) ? data : []);
      setOptionsError(null);
    } catch (error) {
      setOptionsError(error.message);
    }
  }

  async function reloadTiers() {
    setTiersLoading(true);
    try {
      const data = await apiGet("/api/service-tiers");
      setServiceTiers(Array.isArray(data) ? data : []);
      setTierLoadError(null);
    } catch (error) {
      setTierLoadError(error.message);
    } finally {
      setTiersLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiGet("/api/branches/options")
      .then((data) => {
        if (!active) return;
        setBranchOptions(Array.isArray(data) ? data : []);
        setOptionsError(null);
      })
      .catch((error) => {
        if (active) setOptionsError(error.message);
      });
    apiGet("/api/service-tiers")
      .then((data) => {
        if (!active) return;
        setServiceTiers(Array.isArray(data) ? data : []);
        setTierLoadError(null);
      })
      .catch((error) => {
        if (active) setTierLoadError(error.message);
      })
      .finally(() => {
        if (active) setTiersLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleAddBranch(event) {
    event.preventDefault();
    const problems = branchProblems(newBranch);
    if (problems.length) {
      reportBranchError("create", problemText(problems));
      return;
    }
    setSubmittingBranch(true);
    setBranchError(null);
    const body = {
      ...newBranch,
      branch_name: trimmed(newBranch.branch_name),
      contact_number: trimmed(newBranch.contact_number),
      province: trimmed(newBranch.province),
      city_municipality: trimmed(newBranch.city_municipality),
      barangay: trimmed(newBranch.barangay),
      street_address: trimmed(newBranch.street_address),
      postal_code: trimmed(newBranch.postal_code),
    };
    try {
      await apiSend("/api/branches", { body });
      setNewBranch(EMPTY_BRANCH);
      branchesResource.reload();
      void reloadBranchOptions();
    } catch (error) {
      reportBranchError("create", error.message);
    } finally {
      setSubmittingBranch(false);
    }
  }

  function startEditingBranch(branch) {
    setBranchError(null);
    setBranchErrorScope(null);
    setEditingBranchId(branch.branch_id);
    setBranchForm({
      branch_name: branch.branch_name ?? "",
      contact_number: branch.contact_number ?? "",
      province: branch.province ?? "",
      city_municipality: branch.city_municipality ?? "",
      barangay: branch.barangay ?? "",
      street_address: branch.street_address ?? "",
      postal_code: branch.postal_code ?? "",
      latitude: branch.latitude ?? "",
      longitude: branch.longitude ?? "",
    });
  }

  async function handleEditBranchSubmit(event) {
    event.preventDefault();
    const problems = branchProblems(branchForm, { coordinates: true });
    if (problems.length) {
      reportBranchError("edit", problemText(problems));
      return;
    }
    setSubmittingBranch(true);
    setBranchError(null);
    const lat = trimmed(branchForm.latitude);
    const lng = trimmed(branchForm.longitude);
    try {
      await apiSend(`/api/branches/${editingBranchId}`, {
        method: "PATCH",
        body: {
          ...branchForm,
          branch_name: trimmed(branchForm.branch_name),
          contact_number: trimmed(branchForm.contact_number),
          province: trimmed(branchForm.province),
          city_municipality: trimmed(branchForm.city_municipality),
          barangay: trimmed(branchForm.barangay),
          street_address: trimmed(branchForm.street_address),
          postal_code: trimmed(branchForm.postal_code),
          latitude: lat === "" ? null : Number(lat),
          longitude: lng === "" ? null : Number(lng),
        },
      });
      setEditingBranchId(null);
      branchesResource.reload();
      void reloadBranchOptions();
    } catch (error) {
      reportBranchError("edit", error.message);
    } finally {
      setSubmittingBranch(false);
    }
  }

  async function handleToggleAvailability(branch) {
    setTogglingBranchId(branch.branch_id);
    setBranchError(null);
    try {
      await apiSend(`/api/branches/${branch.branch_id}`, { method: "PATCH", body: { is_available: !(branch.is_available ?? true) } });
      branchesResource.reload();
    } catch (error) {
      reportBranchError("list", error.message);
    } finally {
      setTogglingBranchId(null);
    }
  }

  async function handleRetireBranch(branch) {
    setBranchError(null);
    try {
      await apiSend(`/api/branches/${branch.branch_id}`, { method: "DELETE" });
      if (editingBranchId === branch.branch_id) setEditingBranchId(null);
      branchesResource.reload();
      couriersResource.reload();
      void reloadBranchOptions();
    } catch (error) {
      reportBranchError("list", error.message);
    }
  }

  function requestRetireBranch(branch) {
    setConfirm({
      title: "Retire branch?",
      message: `Retire branch ${branch.branch_name} (${branch.city_municipality}, ${branch.province})? This permanently removes it from all use, not just automatic assignment. Parcel history is kept.`,
      confirmLabel: "Retire branch",
      onConfirm: () => { void handleRetireBranch(branch); },
    });
  }

  function startEditingCourier(courier) {
    setCourierError(null);
    setCourierErrorScope(null);
    setEditingCourierId(courier.courier_id);
    setCourierForm({
      phone_number: courier.phone_number ?? "",
      vehicle_type: courier.vehicle_type ?? "",
      assigned_branch_id: courier.assigned_branch_id ?? "",
    });
  }

  async function handleEditCourierSubmit(event) {
    event.preventDefault();
    const problems = courierProblems(courierForm);
    if (problems.length) {
      reportCourierError("edit", problemText(problems));
      return;
    }
    setSubmittingCourier(true);
    setCourierError(null);
    try {
      await apiSend(`/api/couriers/${editingCourierId}`, {
        method: "PATCH",
        body: {
          phone_number: trimmed(courierForm.phone_number),
          vehicle_type: trimmed(courierForm.vehicle_type),
          assigned_branch_id: courierForm.assigned_branch_id ? Number(courierForm.assigned_branch_id) : null,
        },
      });
      setEditingCourierId(null);
      couriersResource.reload();
    } catch (error) {
      reportCourierError("edit", error.message);
    } finally {
      setSubmittingCourier(false);
    }
  }

  async function handleDeleteCourier(courier) {
    setCourierError(null);
    try {
      await apiSend(`/api/couriers/${courier.courier_id}`, { method: "DELETE" });
      if (editingCourierId === courier.courier_id) setEditingCourierId(null);
      couriersResource.reload();
    } catch (error) {
      reportCourierError("list", error.message);
    }
  }

  function requestDeleteCourier(courier) {
    setConfirm({
      title: "Delete courier?",
      message: `Delete courier ${courier.full_name}? This cannot be undone.`,
      confirmLabel: "Delete courier",
      onConfirm: () => { void handleDeleteCourier(courier); },
    });
  }

  function startEditingTier(tier) {
    setTierFormError(null);
    setEditingTierId(tier.tier_id);
    setEditForm({
      tier_name: tier.tier_name,
      base_fee: tier.base_fee,
      base_rate_per_kg: tier.base_rate_per_kg,
      rate_per_km: tier.rate_per_km,
      estimated_days: tier.estimated_days,
    });
  }

  async function handleEditTierSubmit(event) {
    event.preventDefault();
    setSubmittingTier(true);
    setTierFormError(null);
    const baseFee = Number(editForm.base_fee);
    const baseRate = Number(editForm.base_rate_per_kg);
    const rateKm = Number(editForm.rate_per_km);
    const estDays = Number(editForm.estimated_days);
    if (!editForm.tier_name.trim()) {
      setTierFormError("Tier name is required.");
      setSubmittingTier(false);
      return;
    }
    if (baseFee < 0 || baseRate < 0 || rateKm < 0) {
      setTierFormError("Numeric fields cannot be negative.");
      setSubmittingTier(false);
      return;
    }
    if (estDays < 1) {
      setTierFormError("Estimated days must be at least 1.");
      setSubmittingTier(false);
      return;
    }
    try {
      await apiSend(`/api/service-tiers/${editingTierId}`, {
        method: "PUT",
        body: { tier_name: editForm.tier_name, base_fee: baseFee, base_rate_per_kg: baseRate, rate_per_km: rateKm, estimated_days: estDays },
      });
      setEditingTierId(null);
      void reloadTiers();
    } catch (error) {
      setTierFormError(error.message);
    } finally {
      setSubmittingTier(false);
    }
  }

  const branchesPagination = branchesResource.pagination ?? { page: branchesList.page, limit: branchesList.limit, total_items: 0, total_pages: 0 };
  const couriersPagination = couriersResource.pagination ?? { page: couriersList.page, limit: couriersList.limit, total_items: 0, total_pages: 0 };
  const editingBranch = visibleBranches.find((branch) => branch.branch_id === editingBranchId);
  const editingCourier = visibleCouriers.find((courier) => courier.courier_id === editingCourierId);

  return (
    <AppLayout>
      <div className="logistics-page management-page">
        <div className="page-head"><h1>Logistics Management</h1></div>
        {optionsError ? (
          <LogisticsNotice message={`Could not load branch options: ${optionsError}`} onRetry={reloadBranchOptions} />
        ) : null}
        <div className="logistics-grid management-grid">
          <section className="management-section">
            <h2>Branches</h2>
            <form className="logistics-form-card management-form" onSubmit={handleAddBranch} noValidate>
              <BranchFields form={newBranch} invalid={branchErrorScope === "create"} onChange={(patch) => setNewBranch({ ...newBranch, ...patch })} />
              {branchErrorScope === "create" && branchError ? <p className="logistics-form-error" role="alert">{branchError}</p> : null}
              <button type="submit" disabled={submittingBranch}><Plus size={16} /> {submittingBranch && !editingBranchId ? "Adding…" : "Add Branch"}</button>
            </form>
            <p className="management-note">Availability stops new automatic assignments only — in-flight parcels and manual assignment are unaffected.</p>
            <SearchField value={branchesSearch.value} onChange={branchesSearch.setValue} onSubmit={branchesSearch.submit} onClear={branchesSearch.clear} label="Search branches" placeholder="Name or location" />
            {branchErrorScope === "list" && branchError ? <p className="logistics-form-error" role="alert">{branchError}</p> : null}
            {branchesResource.error && visibleBranches.length > 0 ? (
              <LogisticsNotice message={`Could not refresh branches: ${branchesResource.error.message}`} onRetry={branchesResource.reload} />
            ) : null}
            {editingBranch ? <p className="management-active-note">Editing {editingBranch.branch_name}. Save or cancel to leave this record.</p> : null}
            <div className="management-list-wrap" aria-busy={branchesResource.loading}>
              <ListState resource={branchesResource} items={visibleBranches} query={branchesList.q} label="branches" onClear={branchesSearch.clear} onRetry={branchesResource.reload}>
                <ul className="logistics-list">
                  {visibleBranches.map((branch) => {
                    const editing = editingBranchId === branch.branch_id;
                    return (
                      <li key={branch.branch_id} className={`logistics-list-row management-row${editing ? " is-editing" : ""}`} aria-current={editing ? "true" : undefined}>
                        {editing ? (
                          <form className="logistics-edit-form" onSubmit={handleEditBranchSubmit} noValidate>
                            <p className="management-editing-label">Editing this branch</p>
                            <BranchFields form={branchForm} invalid={branchErrorScope === "edit"} onChange={(patch) => setBranchForm({ ...branchForm, ...patch })} />
                            <MapPicker latitude={branchForm.latitude} longitude={branchForm.longitude} onChange={({ latitude, longitude }) => setBranchForm((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }))} />
                            <div className="management-coordinate-grid">
                              <input aria-label="Latitude" type="number" step="any" min="-90" max="90" placeholder="Latitude" value={branchForm.latitude} onChange={(event) => setBranchForm({ ...branchForm, latitude: event.target.value })} />
                              <input aria-label="Longitude" type="number" step="any" min="-180" max="180" placeholder="Longitude" value={branchForm.longitude} onChange={(event) => setBranchForm({ ...branchForm, longitude: event.target.value })} />
                            </div>
                            {branchErrorScope === "edit" && branchError ? <p className="logistics-form-error" role="alert">{branchError}</p> : null}
                            <div className="logistics-edit-actions">
                              <button type="submit" className="logistics-save-btn" disabled={submittingBranch} aria-label="Save branch"><Check size={16} /></button>
                              <button type="button" className="logistics-delete-btn" disabled={submittingBranch} onClick={() => { setEditingBranchId(null); setBranchErrorScope(null); setBranchError(null); }} aria-label="Cancel editing branch"><X size={16} /></button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div>
                              <strong>{branch.branch_name}</strong> — {branch.contact_number}
                              <br />
                              <small>{branch.city_municipality}, {branch.province}</small>
                              <br />
                              <small>{branch.latitude != null && branch.longitude != null ? `Pinned at ${branch.latitude}, ${branch.longitude}` : "No coordinates — excluded from nearest-branch assignment"}</small>
                            </div>
                            <div className="logistics-edit-actions">
                              <label className="management-availability">
                                <input type="checkbox" checked={branch.is_available ?? true} disabled={togglingBranchId === branch.branch_id} onChange={() => handleToggleAvailability(branch)} />
                                {(branch.is_available ?? true) ? "Available" : "Paused"}
                              </label>
                              <button type="button" className="logistics-edit-btn" onClick={() => startEditingBranch(branch)} aria-label={`Edit ${branch.branch_name}`}><Pencil size={16} /></button>
                              <button type="button" className="logistics-delete-btn" onClick={() => requestRetireBranch(branch)} aria-label={`Retire ${branch.branch_name}`}><Trash2 size={16} /></button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </ListState>
            </div>
            <PaginationControls pagination={branchesPagination} onPageChange={branchesList.setPage} onLimitChange={branchesList.setLimit} disabled={branchesResource.loading} ariaLabel="Branches pagination" />
          </section>

          <section className="management-section">
            <h2>Couriers</h2>
            <p className="management-note">Couriers are created from the Admin dashboard. Phone number and vehicle type are required before a courier can be saved.</p>
            <SearchField value={couriersSearch.value} onChange={couriersSearch.setValue} onSubmit={couriersSearch.submit} onClear={couriersSearch.clear} label="Search couriers" placeholder="Name, phone, vehicle, or branch" />
            {courierErrorScope === "list" && courierError ? <p className="logistics-form-error" role="alert">{courierError}</p> : null}
            {couriersResource.error && visibleCouriers.length > 0 ? (
              <LogisticsNotice message={`Could not refresh couriers: ${couriersResource.error.message}`} onRetry={couriersResource.reload} />
            ) : null}
            {editingCourier ? <p className="management-active-note">Editing {editingCourier.full_name}. Save or cancel to leave this record.</p> : null}
            <div className="management-list-wrap" aria-busy={couriersResource.loading}>
              <ListState resource={couriersResource} items={visibleCouriers} query={couriersList.q} label="couriers" onClear={couriersSearch.clear} onRetry={couriersResource.reload}>
                <ul className="logistics-list">
                  {visibleCouriers.map((courier) => {
                    const editing = editingCourierId === courier.courier_id;
                    return (
                      <li key={courier.courier_id} className={`logistics-list-row management-row${editing ? " is-editing" : ""}`} aria-current={editing ? "true" : undefined}>
                        {editing ? (
                          <form className="logistics-edit-form" onSubmit={handleEditCourierSubmit} noValidate>
                            <p className="management-editing-label">Editing this courier</p>
                            <input aria-label="Phone number" aria-invalid={courierErrorScope === "edit"} placeholder="Phone number" required value={courierForm.phone_number} onChange={(event) => setCourierForm({ ...courierForm, phone_number: event.target.value })} />
                            <input aria-label="Vehicle type" aria-invalid={courierErrorScope === "edit"} placeholder="Vehicle type" required value={courierForm.vehicle_type} onChange={(event) => setCourierForm({ ...courierForm, vehicle_type: event.target.value })} />
                            <select aria-label="Assigned branch" value={courierForm.assigned_branch_id} onChange={(event) => setCourierForm({ ...courierForm, assigned_branch_id: event.target.value })}>
                              <option value="">Unassign branch</option>
                              {branchOptions.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}
                            </select>
                            {courierErrorScope === "edit" && courierError ? <p className="logistics-form-error" role="alert">{courierError}</p> : null}
                            <div className="logistics-edit-actions">
                              <button type="submit" className="logistics-save-btn" disabled={submittingCourier} aria-label="Save courier"><Check size={16} /></button>
                              <button type="button" className="logistics-delete-btn" disabled={submittingCourier} onClick={() => { setEditingCourierId(null); setCourierError(null); setCourierErrorScope(null); }} aria-label="Cancel editing courier"><X size={16} /></button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div>
                              <strong>{courier.full_name}</strong> — {courier.phone_number || "No phone"}
                              <br />
                              <small>{courier.vehicle_type || "No vehicle"} • Branch: {courier.assigned_branch_name || "None"}</small>
                            </div>
                            <div className="logistics-edit-actions">
                              <button type="button" className="logistics-edit-btn" onClick={() => startEditingCourier(courier)} aria-label={`Edit ${courier.full_name}`}><Pencil size={16} /></button>
                              <button type="button" className="logistics-delete-btn" onClick={() => requestDeleteCourier(courier)} aria-label={`Delete ${courier.full_name}`}><Trash2 size={16} /></button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </ListState>
            </div>
            <PaginationControls pagination={couriersPagination} onPageChange={couriersList.setPage} onLimitChange={couriersList.setLimit} disabled={couriersResource.loading} ariaLabel="Couriers pagination" />
          </section>

          <section className="management-section management-tiers">
            <h2>Service Tiers</h2>
            {tiersLoading && serviceTiers.length === 0 ? <LogisticsPlaceholder label="service tiers" /> : (
              <>
                {tierLoadError ? <LogisticsNotice message={`Could not load service tiers: ${tierLoadError}`} onRetry={reloadTiers} /> : null}
                {serviceTiers.length === 0 && !tierLoadError ? <LogisticsNotice message="No service tiers yet." /> : serviceTiers.length > 0 ? (
              <ul className="logistics-list management-tier-list">
                {serviceTiers.map((tier) => (
                  <li key={tier.tier_id} className={`logistics-list-row management-row${editingTierId === tier.tier_id ? " is-editing" : ""}`} aria-current={editingTierId === tier.tier_id ? "true" : undefined}>
                    {editingTierId === tier.tier_id ? (
                      <form className="logistics-edit-form" onSubmit={handleEditTierSubmit}>
                        <p className="management-editing-label">Editing this service tier</p>
                        <input aria-label="Tier name" required value={editForm.tier_name} onChange={(event) => setEditForm({ ...editForm, tier_name: event.target.value })} />
                        <div className="management-coordinate-grid">
                          <input aria-label="Base fee" type="number" step="0.01" required value={editForm.base_fee} onChange={(event) => setEditForm({ ...editForm, base_fee: event.target.value })} />
                          <input aria-label="Rate per kilogram" type="number" step="0.01" required value={editForm.base_rate_per_kg} onChange={(event) => setEditForm({ ...editForm, base_rate_per_kg: event.target.value })} />
                          <input aria-label="Rate per kilometre" type="number" step="0.01" required value={editForm.rate_per_km} onChange={(event) => setEditForm({ ...editForm, rate_per_km: event.target.value })} />
                          <input aria-label="Estimated days" type="number" required value={editForm.estimated_days} onChange={(event) => setEditForm({ ...editForm, estimated_days: event.target.value })} />
                        </div>
                        {tierFormError ? <p className="logistics-form-error" role="alert">{tierFormError}</p> : null}
                        <div className="logistics-edit-actions">
                          <button type="submit" className="logistics-save-btn" disabled={submittingTier} aria-label="Save service tier"><Check size={16} /></button>
                          <button type="button" className="logistics-delete-btn" disabled={submittingTier} onClick={() => { setEditingTierId(null); setTierFormError(null); }} aria-label="Cancel editing service tier"><X size={16} /></button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <strong>{tier.tier_name}</strong>
                          <div className="management-tier-details">
                            <span>Base fee: ₱{Number(tier.base_fee).toFixed(2)}</span>
                            <span>Rate / kg: ₱{Number(tier.base_rate_per_kg).toFixed(2)}</span>
                            <span>Rate / km: ₱{Number(tier.rate_per_km).toFixed(2)}</span>
                            <span>Estimated: {tier.estimated_days} days</span>
                          </div>
                        </div>
                        {user?.global_role === "platform_admin" ? (
                          <button type="button" className="logistics-edit-btn" onClick={() => startEditingTier(tier)} aria-label={`Edit ${tier.tier_name}`}><Pencil size={16} /></button>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
                ) : null}
              </>
            )}
          </section>
        </div>
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
