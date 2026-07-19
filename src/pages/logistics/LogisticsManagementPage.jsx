import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import AppLayout from "../../layouts/AppLayout";
import MapPicker from "../../components/ui/MapPicker";
import PaginationControls from "../../components/ui/PaginationControls";
import SearchField from "../../components/ui/SearchField";
import { useAuth } from "../../auth/AuthProvider";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useListUrlState } from "../../hooks/useListUrlState";
import { usePaginatedResource } from "../../hooks/usePaginatedResource";
import { apiGet, apiSend } from "../../lib/api";
import { buildLogisticsListPath } from "./logisticsPagination";
import "./LogisticsManagementPage.css";

const EMPTY_BRANCH = { branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: "" };
const EMPTY_COURIER = { phone_number: "", vehicle_type: "", assigned_branch_id: "" };
const EMPTY_TIER = { tier_name: "", base_fee: "", base_rate_per_kg: "", rate_per_km: "", estimated_days: "" };

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

function ListState({ resource, items, query, label, onClear, children }) {
  if (!resource.data && resource.loading && items.length === 0) return <div className="page-empty">Loading {label}…</div>;
  if (items.length === 0) return <div className="page-empty"><p>{query ? `No ${label} match your search.` : `No ${label} yet.`}</p>{query ? <button type="button" className="logistics-action-btn" onClick={onClear}>Clear search</button> : null}</div>;
  return children;
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
  const [tierError, setTierError] = useState(null);
  const [newBranch, setNewBranch] = useState(EMPTY_BRANCH);
  const [branchError, setBranchError] = useState(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [branchForm, setBranchForm] = useState({ ...EMPTY_BRANCH, latitude: "", longitude: "" });
  const [togglingBranchId, setTogglingBranchId] = useState(null);
  const [courierError, setCourierError] = useState(null);
  const [submittingCourier, setSubmittingCourier] = useState(false);
  const [editingCourierId, setEditingCourierId] = useState(null);
  const [courierForm, setCourierForm] = useState(EMPTY_COURIER);
  const [editingTierId, setEditingTierId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_TIER);
  const [submittingTier, setSubmittingTier] = useState(false);

  useClampListPage(branchesList, branchesResource.pagination);
  useClampListPage(couriersList, couriersResource.pagination);

  async function reloadBranchOptions() {
    try {
      const data = await apiGet("/api/branches/options");
      setBranchOptions(Array.isArray(data) ? data : []); setOptionsError(null);
    } catch (error) { setOptionsError(error.message); }
  }

  async function reloadTiers() {
    setTiersLoading(true);
    try { const data = await apiGet("/api/service-tiers"); setServiceTiers(Array.isArray(data) ? data : []); setTierError(null); }
    catch (error) { setTierError(error.message); } finally { setTiersLoading(false); }
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
        setTierError(null);
      })
      .catch((error) => {
        if (active) setTierError(error.message);
      })
      .finally(() => {
        if (active) setTiersLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleAddBranch(event) {
    event.preventDefault(); setSubmittingBranch(true); setBranchError(null);
    try { await apiSend("/api/branches", { body: newBranch }); setNewBranch(EMPTY_BRANCH); branchesResource.reload(); void reloadBranchOptions(); }
    catch (error) { setBranchError(error.message); } finally { setSubmittingBranch(false); }
  }

  function startEditingBranch(branch) {
    setBranchError(null); setEditingBranchId(branch.branch_id);
    setBranchForm({ branch_name: branch.branch_name ?? "", contact_number: branch.contact_number ?? "", province: branch.province ?? "", city_municipality: branch.city_municipality ?? "", barangay: branch.barangay ?? "", street_address: branch.street_address ?? "", postal_code: branch.postal_code ?? "", latitude: branch.latitude ?? "", longitude: branch.longitude ?? "" });
  }

  async function handleEditBranchSubmit(event) {
    event.preventDefault(); setSubmittingBranch(true); setBranchError(null);
    const lat = String(branchForm.latitude).trim(); const lng = String(branchForm.longitude).trim();
    if ((lat === "") !== (lng === "")) { setBranchError("Provide both latitude and longitude, or neither."); setSubmittingBranch(false); return; }
    try {
      await apiSend(`/api/branches/${editingBranchId}`, { method: "PATCH", body: { ...branchForm, latitude: lat === "" ? null : Number(lat), longitude: lng === "" ? null : Number(lng) } });
      setEditingBranchId(null); branchesResource.reload(); void reloadBranchOptions();
    } catch (error) { setBranchError(error.message); } finally { setSubmittingBranch(false); }
  }

  async function handleToggleAvailability(branch) {
    setTogglingBranchId(branch.branch_id); setBranchError(null);
    try { await apiSend(`/api/branches/${branch.branch_id}`, { method: "PATCH", body: { is_available: !(branch.is_available ?? true) } }); branchesResource.reload(); }
    catch (error) { setBranchError(error.message); } finally { setTogglingBranchId(null); }
  }

  async function handleRetireBranch(branch) {
    if (!window.confirm(`Retire branch "${branch.branch_name}"? This permanently removes it from all use (not just automatic assignment). Parcel history is kept.`)) return;
    setBranchError(null);
    try { await apiSend(`/api/branches/${branch.branch_id}`, { method: "DELETE" }); branchesResource.reload(); couriersResource.reload(); void reloadBranchOptions(); }
    catch (error) { setBranchError(error.message); }
  }

  function startEditingCourier(courier) {
    setCourierError(null); setEditingCourierId(courier.courier_id);
    setCourierForm({ phone_number: courier.phone_number ?? "", vehicle_type: courier.vehicle_type ?? "", assigned_branch_id: courier.assigned_branch_id ?? "" });
  }

  async function handleEditCourierSubmit(event) {
    event.preventDefault(); setSubmittingCourier(true); setCourierError(null);
    try {
      await apiSend(`/api/couriers/${editingCourierId}`, { method: "PATCH", body: { phone_number: courierForm.phone_number.trim() || null, vehicle_type: courierForm.vehicle_type.trim() || null, assigned_branch_id: courierForm.assigned_branch_id ? Number(courierForm.assigned_branch_id) : null } });
      setEditingCourierId(null); couriersResource.reload();
    } catch (error) { setCourierError(error.message); } finally { setSubmittingCourier(false); }
  }

  async function handleDeleteCourier(courier) {
    if (!window.confirm(`Delete courier "${courier.full_name}"?`)) return;
    setCourierError(null);
    try { await apiSend(`/api/couriers/${courier.courier_id}`, { method: "DELETE" }); couriersResource.reload(); }
    catch (error) { setCourierError(error.message); }
  }

  function startEditingTier(tier) { setTierError(null); setEditingTierId(tier.tier_id); setEditForm({ tier_name: tier.tier_name, base_fee: tier.base_fee, base_rate_per_kg: tier.base_rate_per_kg, rate_per_km: tier.rate_per_km, estimated_days: tier.estimated_days }); }
  async function handleEditTierSubmit(event) {
    event.preventDefault(); setSubmittingTier(true); setTierError(null);
    const baseFee = Number(editForm.base_fee); const baseRate = Number(editForm.base_rate_per_kg); const rateKm = Number(editForm.rate_per_km); const estDays = Number(editForm.estimated_days);
    if (!editForm.tier_name.trim()) { setTierError("Tier name is required"); setSubmittingTier(false); return; }
    if (baseFee < 0 || baseRate < 0 || rateKm < 0) { setTierError("Numeric fields cannot be negative"); setSubmittingTier(false); return; }
    if (estDays < 1) { setTierError("Estimated days must be at least 1"); setSubmittingTier(false); return; }
    try { await apiSend(`/api/service-tiers/${editingTierId}`, { method: "PUT", body: { tier_name: editForm.tier_name, base_fee: baseFee, base_rate_per_kg: baseRate, rate_per_km: rateKm, estimated_days: estDays } }); setEditingTierId(null); void reloadTiers(); }
    catch (error) { setTierError(error.message); } finally { setSubmittingTier(false); }
  }

  const branchesPagination = branchesResource.pagination ?? { page: branchesList.page, limit: branchesList.limit, total_items: 0, total_pages: 0 };
  const couriersPagination = couriersResource.pagination ?? { page: couriersList.page, limit: couriersList.limit, total_items: 0, total_pages: 0 };

  return <AppLayout><div className="logistics-page management-page"><div className="page-head"><h1>Logistics Management</h1></div>{optionsError ? <div className="page-empty management-error">Could not load branch options: {optionsError}</div> : null}<div className="logistics-grid management-grid">
    <section className="management-section"><h2>Branches</h2><form className="logistics-form-card management-form" onSubmit={handleAddBranch}><input aria-label="Branch name" placeholder="Branch name" required value={newBranch.branch_name} onChange={(event) => setNewBranch({ ...newBranch, branch_name: event.target.value })} /><input aria-label="Contact number" placeholder="Contact number" required value={newBranch.contact_number} onChange={(event) => setNewBranch({ ...newBranch, contact_number: event.target.value })} /><input aria-label="Province" placeholder="Province" required value={newBranch.province} onChange={(event) => setNewBranch({ ...newBranch, province: event.target.value })} /><input aria-label="City or municipality" placeholder="City or municipality" required value={newBranch.city_municipality} onChange={(event) => setNewBranch({ ...newBranch, city_municipality: event.target.value })} /><input aria-label="Barangay" placeholder="Barangay" value={newBranch.barangay} onChange={(event) => setNewBranch({ ...newBranch, barangay: event.target.value })} /><input aria-label="Street address" placeholder="Street address" value={newBranch.street_address} onChange={(event) => setNewBranch({ ...newBranch, street_address: event.target.value })} /><input aria-label="Postal code" placeholder="Postal code" value={newBranch.postal_code} onChange={(event) => setNewBranch({ ...newBranch, postal_code: event.target.value })} /><button type="submit" disabled={submittingBranch}><Plus size={16} /> {submittingBranch ? "Adding…" : "Add Branch"}</button></form>{branchError ? <p className="logistics-form-error">{branchError}</p> : null}<p className="management-note">Availability stops new automatic assignments only — in-flight parcels and manual assignment are unaffected.</p><SearchField value={branchesSearch.value} onChange={branchesSearch.setValue} onSubmit={branchesSearch.submit} onClear={branchesSearch.clear} label="Search branches" placeholder="Name or location" />{branchesResource.error ? <div className="page-empty">Could not load branches: {branchesResource.error.message}</div> : null}<div className="management-list-wrap" aria-busy={branchesResource.loading}><ListState resource={branchesResource} items={visibleBranches} query={branchesList.q} label="branches" onClear={branchesSearch.clear}><ul className="logistics-list">{visibleBranches.map((branch) => <li key={branch.branch_id} className="logistics-list-row management-row">{editingBranchId === branch.branch_id ? <form className="logistics-edit-form" onSubmit={handleEditBranchSubmit}><input aria-label="Branch name" required value={branchForm.branch_name} onChange={(event) => setBranchForm({ ...branchForm, branch_name: event.target.value })} /><input aria-label="Contact number" required value={branchForm.contact_number} onChange={(event) => setBranchForm({ ...branchForm, contact_number: event.target.value })} /><input aria-label="Province" required value={branchForm.province} onChange={(event) => setBranchForm({ ...branchForm, province: event.target.value })} /><input aria-label="City or municipality" required value={branchForm.city_municipality} onChange={(event) => setBranchForm({ ...branchForm, city_municipality: event.target.value })} /><input aria-label="Barangay" value={branchForm.barangay} onChange={(event) => setBranchForm({ ...branchForm, barangay: event.target.value })} /><input aria-label="Street address" value={branchForm.street_address} onChange={(event) => setBranchForm({ ...branchForm, street_address: event.target.value })} /><input aria-label="Postal code" value={branchForm.postal_code} onChange={(event) => setBranchForm({ ...branchForm, postal_code: event.target.value })} /><MapPicker latitude={branchForm.latitude} longitude={branchForm.longitude} onChange={({ latitude, longitude }) => setBranchForm((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }))} /><div className="management-coordinate-grid"><input aria-label="Latitude" type="number" step="any" min="-90" max="90" placeholder="Latitude" value={branchForm.latitude} onChange={(event) => setBranchForm({ ...branchForm, latitude: event.target.value })} /><input aria-label="Longitude" type="number" step="any" min="-180" max="180" placeholder="Longitude" value={branchForm.longitude} onChange={(event) => setBranchForm({ ...branchForm, longitude: event.target.value })} /></div><div className="logistics-edit-actions"><button type="submit" className="logistics-save-btn" disabled={submittingBranch} aria-label="Save branch"><Check size={16} /></button><button type="button" className="logistics-delete-btn" disabled={submittingBranch} onClick={() => setEditingBranchId(null)} aria-label="Cancel editing branch"><X size={16} /></button></div></form> : <><div><strong>{branch.branch_name}</strong> — {branch.contact_number}<br /><small>{branch.city_municipality}, {branch.province}</small><br /><small>{branch.latitude != null && branch.longitude != null ? `Pinned at ${branch.latitude}, ${branch.longitude}` : "No coordinates — excluded from nearest-branch assignment"}</small></div><div className="logistics-edit-actions"><label className="management-availability"><input type="checkbox" checked={branch.is_available ?? true} disabled={togglingBranchId === branch.branch_id} onChange={() => handleToggleAvailability(branch)} />{(branch.is_available ?? true) ? "Available" : "Paused"}</label><button type="button" className="logistics-edit-btn" onClick={() => startEditingBranch(branch)} aria-label={`Edit ${branch.branch_name}`}><Pencil size={16} /></button><button type="button" className="logistics-delete-btn" onClick={() => handleRetireBranch(branch)} aria-label={`Retire ${branch.branch_name}`}><Trash2 size={16} /></button></div></>}</li>)}</ul></ListState></div><PaginationControls pagination={branchesPagination} onPageChange={branchesList.setPage} onLimitChange={branchesList.setLimit} disabled={branchesResource.loading} ariaLabel="Branches pagination" /></section>
    <section className="management-section"><h2>Couriers</h2><p className="management-note">Couriers are created from the Admin dashboard.</p>{courierError ? <p className="logistics-form-error">{courierError}</p> : null}<SearchField value={couriersSearch.value} onChange={couriersSearch.setValue} onSubmit={couriersSearch.submit} onClear={couriersSearch.clear} label="Search couriers" placeholder="Name, phone, vehicle, or branch" />{couriersResource.error ? <div className="page-empty">Could not load couriers: {couriersResource.error.message}</div> : null}<div className="management-list-wrap" aria-busy={couriersResource.loading}><ListState resource={couriersResource} items={visibleCouriers} query={couriersList.q} label="couriers" onClear={couriersSearch.clear}><ul className="logistics-list">{visibleCouriers.map((courier) => <li key={courier.courier_id} className="logistics-list-row management-row">{editingCourierId === courier.courier_id ? <form className="logistics-edit-form" onSubmit={handleEditCourierSubmit}><input aria-label="Phone number" placeholder="Phone number" value={courierForm.phone_number} onChange={(event) => setCourierForm({ ...courierForm, phone_number: event.target.value })} /><input aria-label="Vehicle type" placeholder="Vehicle type" value={courierForm.vehicle_type} onChange={(event) => setCourierForm({ ...courierForm, vehicle_type: event.target.value })} /><select aria-label="Assigned branch" value={courierForm.assigned_branch_id} onChange={(event) => setCourierForm({ ...courierForm, assigned_branch_id: event.target.value })}><option value="">Unassign branch</option>{branchOptions.map((branch) => <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>)}</select><div className="logistics-edit-actions"><button type="submit" className="logistics-save-btn" disabled={submittingCourier} aria-label="Save courier"><Check size={16} /></button><button type="button" className="logistics-delete-btn" disabled={submittingCourier} onClick={() => setEditingCourierId(null)} aria-label="Cancel editing courier"><X size={16} /></button></div></form> : <><div><strong>{courier.full_name}</strong> — {courier.phone_number || "No phone"}<br /><small>{courier.vehicle_type || "No vehicle"} • Branch: {courier.assigned_branch_name || "None"}</small></div><div className="logistics-edit-actions"><button type="button" className="logistics-edit-btn" onClick={() => startEditingCourier(courier)} aria-label={`Edit ${courier.full_name}`}><Pencil size={16} /></button><button type="button" className="logistics-delete-btn" onClick={() => handleDeleteCourier(courier)} aria-label={`Delete ${courier.full_name}`}><Trash2 size={16} /></button></div></>}</li>)}</ul></ListState></div><PaginationControls pagination={couriersPagination} onPageChange={couriersList.setPage} onLimitChange={couriersList.setLimit} disabled={couriersResource.loading} ariaLabel="Couriers pagination" /></section>
    <section className="management-section management-tiers"><h2>Service Tiers</h2>{tierError ? <p className="logistics-form-error">{tierError}</p> : null}{tiersLoading ? <div className="page-empty">Loading service tiers…</div> : <ul className="logistics-list management-tier-list">{serviceTiers.map((tier) => <li key={tier.tier_id} className="logistics-list-row management-row">{editingTierId === tier.tier_id ? <form className="logistics-edit-form" onSubmit={handleEditTierSubmit}><input aria-label="Tier name" required value={editForm.tier_name} onChange={(event) => setEditForm({ ...editForm, tier_name: event.target.value })} /><div className="management-coordinate-grid"><input aria-label="Base fee" type="number" step="0.01" required value={editForm.base_fee} onChange={(event) => setEditForm({ ...editForm, base_fee: event.target.value })} /><input aria-label="Rate per kilogram" type="number" step="0.01" required value={editForm.base_rate_per_kg} onChange={(event) => setEditForm({ ...editForm, base_rate_per_kg: event.target.value })} /><input aria-label="Rate per kilometre" type="number" step="0.01" required value={editForm.rate_per_km} onChange={(event) => setEditForm({ ...editForm, rate_per_km: event.target.value })} /><input aria-label="Estimated days" type="number" required value={editForm.estimated_days} onChange={(event) => setEditForm({ ...editForm, estimated_days: event.target.value })} /></div><div className="logistics-edit-actions"><button type="submit" className="logistics-save-btn" disabled={submittingTier} aria-label="Save service tier"><Check size={16} /></button><button type="button" className="logistics-delete-btn" disabled={submittingTier} onClick={() => setEditingTierId(null)} aria-label="Cancel editing service tier"><X size={16} /></button></div></form> : <><div><strong>{tier.tier_name}</strong><div className="management-tier-details"><span>Base fee: ₱{Number(tier.base_fee).toFixed(2)}</span><span>Rate / kg: ₱{Number(tier.base_rate_per_kg).toFixed(2)}</span><span>Rate / km: ₱{Number(tier.rate_per_km).toFixed(2)}</span><span>Estimated: {tier.estimated_days} days</span></div></div>{user?.global_role === "platform_admin" ? <button type="button" className="logistics-edit-btn" onClick={() => startEditingTier(tier)} aria-label={`Edit ${tier.tier_name}`}><Pencil size={16} /></button> : null}</>}</li>)}</ul>}</section>
  </div></div></AppLayout>;
}
