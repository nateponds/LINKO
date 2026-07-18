import { useEffect, useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import { apiGet, apiSend } from "../../lib/api";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

export default function LogisticsManagementPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [serviceTiers, setServiceTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [submittingCourier, setSubmittingCourier] = useState(false);
  const [editingCourierId, setEditingCourierId] = useState(null);
  const [courierForm, setCourierForm] = useState({
    phone_number: "", vehicle_type: "", assigned_branch_id: ""
  });
  const [submittingTier, setSubmittingTier] = useState(false);
  const [branchError, setBranchError] = useState(null);
  const [courierError, setCourierError] = useState(null);
  const [tierError, setTierError] = useState(null);

  // Form states
  const [newBranch, setNewBranch] = useState({
    branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: ""
  });
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [branchForm, setBranchForm] = useState({
    branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: "", latitude: "", longitude: ""
  });
  const [togglingBranchId, setTogglingBranchId] = useState(null);
  const [editingTierId, setEditingTierId] = useState(null);
  const [editForm, setEditForm] = useState({
    tier_name: "", base_fee: "", base_rate_per_kg: "", rate_per_km: "", estimated_days: ""
  });

  const fetchData = async () => Promise.all([
    apiGet("/api/branches"),
    apiGet("/api/couriers"),
    apiGet("/api/service-tiers")
  ]);

  const refreshData = async () => {
    try {
      const [b, c, t] = await fetchData();
      setBranches(b);
      setCouriers(c);
      setServiceTiers(t);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [b, c, t] = await fetchData();
        if (cancelled) return;
        setBranches(b);
        setCouriers(c);
        setServiceTiers(t);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteCourier = async (id, name) => {
    if (!window.confirm(`Delete courier "${name}"?`)) return;
    setCourierError(null);
    try {
      await apiSend(`/api/couriers/${id}`, { method: "DELETE" });
      await refreshData();
    } catch (err) {
      setCourierError(err.message);
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    setSubmittingBranch(true);
    setBranchError(null);
    try {
      await apiSend("/api/branches", { body: newBranch });
      setNewBranch({ branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: "" });
      await refreshData();
    } catch (err) {
      setBranchError(err.message);
    } finally {
      setSubmittingBranch(false);
    }
  };

  const startEditingBranch = (branch) => {
    setBranchError(null);
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
  };

  const handleEditBranchSubmit = async (e) => {
    e.preventDefault();
    setSubmittingBranch(true);
    setBranchError(null);

    // Both coordinates or neither; an empty pair explicitly unpins the branch
    // (it drops out of automatic assignment). The backend validator is the
    // authority — this only catches the obvious one-sided case early.
    const lat = String(branchForm.latitude).trim();
    const lng = String(branchForm.longitude).trim();
    if ((lat === "") !== (lng === "")) {
      setBranchError("Provide both latitude and longitude, or neither");
      setSubmittingBranch(false);
      return;
    }

    try {
      await apiSend(`/api/branches/${editingBranchId}`, {
        method: "PATCH",
        body: {
          branch_name: branchForm.branch_name,
          contact_number: branchForm.contact_number,
          province: branchForm.province,
          city_municipality: branchForm.city_municipality,
          barangay: branchForm.barangay,
          street_address: branchForm.street_address,
          postal_code: branchForm.postal_code,
          latitude: lat === "" ? null : Number(lat),
          longitude: lng === "" ? null : Number(lng),
        },
      });
      setEditingBranchId(null);
      await refreshData();
    } catch (err) {
      setBranchError(err.message);
    } finally {
      setSubmittingBranch(false);
    }
  };

  const handleToggleAvailability = async (branch) => {
    setTogglingBranchId(branch.branch_id);
    setBranchError(null);
    try {
      await apiSend(`/api/branches/${branch.branch_id}`, {
        method: "PATCH",
        body: { is_available: !(branch.is_available ?? true) },
      });
      await refreshData();
    } catch (err) {
      setBranchError(err.message);
    } finally {
      setTogglingBranchId(null);
    }
  };

  const handleRetireBranch = async (branch) => {
    if (!window.confirm(
      `Retire branch "${branch.branch_name}"? This permanently removes it from all use (not just automatic assignment). Parcel history is kept.`,
    )) return;
    setBranchError(null);
    try {
      await apiSend(`/api/branches/${branch.branch_id}`, { method: "DELETE" });
      await refreshData();
    } catch (err) {
      setBranchError(err.message);
    }
  };

  const startEditingCourier = (courier) => {
    setCourierError(null);
    setEditingCourierId(courier.courier_id);
    setCourierForm({
      phone_number: courier.phone_number ?? "",
      vehicle_type: courier.vehicle_type ?? "",
      assigned_branch_id: courier.assigned_branch_id ?? "",
    });
  };

  const handleEditCourierSubmit = async (e) => {
    e.preventDefault();
    setSubmittingCourier(true);
    setCourierError(null);
    try {
      // assigned_branch_id is always sent: "" means unassign (null).
      const body = {
        phone_number: courierForm.phone_number.trim() || null,
        vehicle_type: courierForm.vehicle_type.trim() || null,
        assigned_branch_id: courierForm.assigned_branch_id
          ? Number(courierForm.assigned_branch_id)
          : null,
      };
      await apiSend(`/api/couriers/${editingCourierId}`, { method: "PATCH", body });
      setEditingCourierId(null);
      await refreshData();
    } catch (err) {
      setCourierError(err.message);
    } finally {
      setSubmittingCourier(false);
    }
  };

  const handleEditTierSubmit = async (e) => {
    e.preventDefault();
    setSubmittingTier(true);
    setTierError(null);

    if (!editForm.tier_name.trim()) {
      setTierError("Tier name is required");
      setSubmittingTier(false);
      return;
    }
    
    const baseFee = Number(editForm.base_fee);
    const baseRate = Number(editForm.base_rate_per_kg);
    const rateKm = Number(editForm.rate_per_km);
    const estDays = Number(editForm.estimated_days);

    if (baseFee < 0 || baseRate < 0 || rateKm < 0) {
      setTierError("Numeric fields cannot be negative");
      setSubmittingTier(false);
      return;
    }
    
    if (estDays < 1) {
      setTierError("Estimated days must be at least 1");
      setSubmittingTier(false);
      return;
    }

    try {
      await apiSend(`/api/service-tiers/${editingTierId}`, {
        method: "PUT",
        body: {
          tier_name: editForm.tier_name,
          base_fee: baseFee,
          base_rate_per_kg: baseRate,
          rate_per_km: rateKm,
          estimated_days: estDays
        }
      });
      setEditingTierId(null);
      await refreshData();
    } catch (err) {
      setTierError(err.message);
    } finally {
      setSubmittingTier(false);
    }
  };

  const startEditing = (tier) => {
    setTierError(null);
    setEditingTierId(tier.tier_id);
    setEditForm({
      tier_name: tier.tier_name,
      base_fee: tier.base_fee,
      base_rate_per_kg: tier.base_rate_per_kg,
      rate_per_km: tier.rate_per_km,
      estimated_days: tier.estimated_days
    });
  };

  return (
    <AppLayout>
      <div className="logistics-page">
        <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>Logistics Management</h1>

        {loading ? <p style={{textAlign: 'center'}}>Loading...</p> : error ? <p style={{color: 'red', textAlign: 'center'}}>{error}</p> : (
          <div className="logistics-grid">

            {/* Branches Section */}
            <div>
              <h2 style={{ textAlign: 'center' }}>Branches</h2>
              <div className="logistics-form-card">
                <form onSubmit={handleAddBranch}>
                  <input type="text" placeholder="Branch Name" required value={newBranch.branch_name} onChange={e => setNewBranch({...newBranch, branch_name: e.target.value})} />
                  <input type="text" placeholder="Contact Number" required value={newBranch.contact_number} onChange={e => setNewBranch({...newBranch, contact_number: e.target.value})} />
                  <input type="text" placeholder="Province" required value={newBranch.province} onChange={e => setNewBranch({...newBranch, province: e.target.value})} />
                  <input type="text" placeholder="City" required value={newBranch.city_municipality} onChange={e => setNewBranch({...newBranch, city_municipality: e.target.value})} />
                  <input type="text" placeholder="Barangay" value={newBranch.barangay} onChange={e => setNewBranch({...newBranch, barangay: e.target.value})} />
                  <input type="text" placeholder="Street Address" value={newBranch.street_address} onChange={e => setNewBranch({...newBranch, street_address: e.target.value})} />
                  <input type="text" placeholder="Postal Code" value={newBranch.postal_code} onChange={e => setNewBranch({...newBranch, postal_code: e.target.value})} />
                  <button type="submit" disabled={submittingBranch}>
                    <Plus size={16} /> {submittingBranch ? "Adding…" : "Add Branch"}
                  </button>
                  {branchError && <p className="logistics-form-error">{branchError}</p>}
                </form>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.7, margin: '1rem 0' }}>
                Availability stops new automatic assignments only — in-flight
                parcels and manual assignment are unaffected.
              </p>
              <ul className="logistics-list">
                {branches.map(b => (
                  <li key={b.branch_id} className="logistics-list-row" style={{ alignItems: 'flex-start' }}>
                    {editingBranchId === b.branch_id ? (
                      <form className="logistics-edit-form" onSubmit={handleEditBranchSubmit} style={{ width: '100%' }}>
                        <input type="text" placeholder="Branch Name" required value={branchForm.branch_name} onChange={e => setBranchForm({...branchForm, branch_name: e.target.value})} />
                        <input type="text" placeholder="Contact Number" required value={branchForm.contact_number} onChange={e => setBranchForm({...branchForm, contact_number: e.target.value})} />
                        <input type="text" placeholder="Province" required value={branchForm.province} onChange={e => setBranchForm({...branchForm, province: e.target.value})} />
                        <input type="text" placeholder="City" required value={branchForm.city_municipality} onChange={e => setBranchForm({...branchForm, city_municipality: e.target.value})} />
                        <input type="text" placeholder="Barangay" value={branchForm.barangay} onChange={e => setBranchForm({...branchForm, barangay: e.target.value})} />
                        <input type="text" placeholder="Street Address" value={branchForm.street_address} onChange={e => setBranchForm({...branchForm, street_address: e.target.value})} />
                        <input type="text" placeholder="Postal Code" value={branchForm.postal_code} onChange={e => setBranchForm({...branchForm, postal_code: e.target.value})} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input type="number" step="any" min="-90" max="90" placeholder="Latitude" value={branchForm.latitude} onChange={e => setBranchForm({...branchForm, latitude: e.target.value})} />
                          <input type="number" step="any" min="-180" max="180" placeholder="Longitude" value={branchForm.longitude} onChange={e => setBranchForm({...branchForm, longitude: e.target.value})} />
                        </div>
                        <div className="logistics-edit-actions" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button type="submit" className="logistics-save-btn" disabled={submittingBranch} title="Save">
                            <Check size={16} />
                          </button>
                          <button type="button" className="logistics-delete-btn" disabled={submittingBranch} onClick={() => setEditingBranchId(null)} title="Cancel">
                            <X size={16} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <strong>{b.branch_name}</strong> - {b.contact_number}<br/>
                          <small>{b.city_municipality}, {b.province}</small><br/>
                          <small style={{ opacity: 0.7 }}>
                            {b.latitude != null && b.longitude != null
                              ? `Pinned at ${b.latitude}, ${b.longitude}`
                              : "No coordinates — excluded from nearest-branch assignment"}
                          </small>
                        </div>
                        <div className="logistics-edit-actions" style={{ alignItems: 'center' }}>
                          <label title="Stops new automatic assignments only" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={b.is_available ?? true}
                              disabled={togglingBranchId === b.branch_id}
                              onChange={() => handleToggleAvailability(b)}
                            />
                            {(b.is_available ?? true) ? "Available" : "Paused"}
                          </label>
                          <button type="button" className="logistics-edit-btn" title="Edit branch"
                            onClick={() => startEditingBranch(b)}>
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="logistics-delete-btn" title="Retire branch"
                            onClick={() => handleRetireBranch(b)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Couriers Section */}
            <div>
              <h2 style={{ textAlign: 'center' }}>Couriers</h2>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>
                Couriers are created from the Admin dashboard.
              </p>
              {courierError && <p className="logistics-form-error" style={{ marginBottom: '1rem' }}>{courierError}</p>}
              <ul className="logistics-list">
                {couriers.map(c => (
                  <li key={c.courier_id} className="logistics-list-row" style={{ alignItems: 'flex-start' }}>
                    {editingCourierId === c.courier_id ? (
                      <form className="logistics-edit-form" onSubmit={handleEditCourierSubmit} style={{ width: '100%' }}>
                        <input type="text" placeholder="Phone Number" value={courierForm.phone_number} onChange={e => setCourierForm({...courierForm, phone_number: e.target.value})} />
                        <input type="text" placeholder="Vehicle Type (e.g. Van, Motorcycle)" value={courierForm.vehicle_type} onChange={e => setCourierForm({...courierForm, vehicle_type: e.target.value})} />
                        <select value={courierForm.assigned_branch_id} onChange={e => setCourierForm({...courierForm, assigned_branch_id: e.target.value})}>
                          <option value="">-- Unassign --</option>
                          {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                        </select>
                        <div className="logistics-edit-actions" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button type="submit" className="logistics-save-btn" disabled={submittingCourier} title="Save">
                            <Check size={16} />
                          </button>
                          <button type="button" className="logistics-delete-btn" disabled={submittingCourier} onClick={() => setEditingCourierId(null)} title="Cancel">
                            <X size={16} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <strong>{c.full_name}</strong> - {c.phone_number}<br/>
                          <small>{c.vehicle_type} • Branch: {branches.find(b => b.branch_id === c.assigned_branch_id)?.branch_name || 'None'}</small>
                        </div>
                        <div className="logistics-edit-actions">
                          <button type="button" className="logistics-edit-btn" title="Edit courier"
                            onClick={() => startEditingCourier(c)}>
                            <Pencil size={16} />
                          </button>
                          <button type="button" className="logistics-delete-btn" title="Delete courier"
                            onClick={() => handleDeleteCourier(c.courier_id, c.full_name)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Service Tiers Section */}
            <div style={{ gridColumn: '1 / -1' }}>
              <h2 style={{ textAlign: 'center' }}>Service Tiers</h2>
              {tierError && <p className="logistics-form-error" style={{ marginBottom: '1rem' }}>{tierError}</p>}
              <ul className="logistics-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', justifyContent: 'center' }}>
                {serviceTiers.map(t => (
                  <li key={t.tier_id} className="logistics-list-row" style={{ alignItems: 'flex-start' }}>
                    {editingTierId === t.tier_id ? (
                      <form className="logistics-edit-form" onSubmit={handleEditTierSubmit}>
                        <input type="text" placeholder="Tier Name" required value={editForm.tier_name} onChange={e => setEditForm({...editForm, tier_name: e.target.value})} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div className="logistics-tier-field">
                            <label>Base Fee</label>
                            <input type="number" step="0.01" required value={editForm.base_fee} onChange={e => setEditForm({...editForm, base_fee: e.target.value})} />
                          </div>
                          <div className="logistics-tier-field">
                            <label>Rate / kg</label>
                            <input type="number" step="0.01" required value={editForm.base_rate_per_kg} onChange={e => setEditForm({...editForm, base_rate_per_kg: e.target.value})} />
                          </div>
                          <div className="logistics-tier-field">
                            <label>Rate / km</label>
                            <input type="number" step="0.01" required value={editForm.rate_per_km} onChange={e => setEditForm({...editForm, rate_per_km: e.target.value})} />
                          </div>
                          <div className="logistics-tier-field">
                            <label>Est. Days</label>
                            <input type="number" required value={editForm.estimated_days} onChange={e => setEditForm({...editForm, estimated_days: e.target.value})} />
                          </div>
                        </div>
                        <div className="logistics-edit-actions" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button type="submit" className="logistics-save-btn" disabled={submittingTier} title="Save">
                            <Check size={16} />
                          </button>
                          <button type="button" className="logistics-delete-btn" disabled={submittingTier} onClick={() => setEditingTierId(null)} title="Cancel">
                            <X size={16} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '0.8rem' }}>
                            <strong style={{ fontSize: '1.05rem' }}>{t.tier_name}</strong>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                            <div className="logistics-tier-field">
                              <strong>Base Fee</strong>
                              <span>₱{Number(t.base_fee).toFixed(2)}</span>
                            </div>
                            <div className="logistics-tier-field">
                              <strong>Rate / kg</strong>
                              <span>₱{Number(t.base_rate_per_kg).toFixed(2)}</span>
                            </div>
                            <div className="logistics-tier-field">
                              <strong>Rate / km</strong>
                              <span>₱{Number(t.rate_per_km).toFixed(2)}</span>
                            </div>
                            <div className="logistics-tier-field">
                              <strong>Est. Days</strong>
                              <span>{t.estimated_days} days</span>
                            </div>
                          </div>
                        </div>
                        {user?.global_role === "platform_admin" && (
                          <button type="button" className="logistics-edit-btn" title="Edit tier" onClick={() => startEditing(t)} style={{ alignSelf: 'flex-start' }}>
                            <Pencil size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}
      </div>
    </AppLayout>
  );
}
