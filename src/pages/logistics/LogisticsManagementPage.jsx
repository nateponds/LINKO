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
  const [submittingTier, setSubmittingTier] = useState(false);
  const [branchError, setBranchError] = useState(null);
  const [courierError, setCourierError] = useState(null);
  const [tierError, setTierError] = useState(null);

  // Form states
  const [newBranch, setNewBranch] = useState({
    branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: ""
  });
  const [newCourier, setNewCourier] = useState({
    full_name: "", phone_number: "", vehicle_type: "", assigned_branch_id: ""
  });
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

  const handleDelete = async (kind, id, name) => {
    if (!window.confirm(`Delete ${kind} "${name}"?`)) return;
    const setScopedError = kind === "branch" ? setBranchError : setCourierError;
    setScopedError(null);
    try {
      await apiSend(`/api/${kind === "branch" ? "branches" : "couriers"}/${id}`, { method: "DELETE" });
      await refreshData();
    } catch (err) {
      setScopedError(err.message);
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

  const handleAddCourier = async (e) => {
    e.preventDefault();
    setSubmittingCourier(true);
    setCourierError(null);
    try {
      const payload = { ...newCourier };
      if (!payload.assigned_branch_id) delete payload.assigned_branch_id;
      else payload.assigned_branch_id = Number(payload.assigned_branch_id);

      await apiSend("/api/couriers", { body: payload });
      setNewCourier({ full_name: "", phone_number: "", vehicle_type: "", assigned_branch_id: "" });
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
              <ul className="logistics-list">
                {branches.map(b => (
                  <li key={b.branch_id} className="logistics-list-row">
                    <div>
                      <strong>{b.branch_name}</strong> - {b.contact_number}<br/>
                      <small>{b.city_municipality}, {b.province}</small>
                    </div>
                    <button type="button" className="logistics-delete-btn" title="Delete branch"
                      onClick={() => handleDelete("branch", b.branch_id, b.branch_name)}>
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Couriers Section */}
            <div>
              <h2 style={{ textAlign: 'center' }}>Couriers</h2>
              <div className="logistics-form-card">
                <form onSubmit={handleAddCourier}>
                  <input type="text" placeholder="Full Name" required value={newCourier.full_name} onChange={e => setNewCourier({...newCourier, full_name: e.target.value})} />
                  <input type="text" placeholder="Phone Number" required value={newCourier.phone_number} onChange={e => setNewCourier({...newCourier, phone_number: e.target.value})} />
                  <input type="text" placeholder="Vehicle Type (e.g. Van, Motorcycle)" value={newCourier.vehicle_type} onChange={e => setNewCourier({...newCourier, vehicle_type: e.target.value})} />
                  <select value={newCourier.assigned_branch_id} onChange={e => setNewCourier({...newCourier, assigned_branch_id: e.target.value})}>
                    <option value="">-- Assign to Branch (Optional) --</option>
                    {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                  </select>
                  <button type="submit" disabled={submittingCourier}>
                    <Plus size={16} /> {submittingCourier ? "Adding…" : "Add Courier"}
                  </button>
                  {courierError && <p className="logistics-form-error">{courierError}</p>}
                </form>
              </div>
              <ul className="logistics-list">
                {couriers.map(c => (
                  <li key={c.courier_id} className="logistics-list-row">
                    <div>
                      <strong>{c.full_name}</strong> - {c.phone_number}<br/>
                      <small>{c.vehicle_type} • Branch: {branches.find(b => b.branch_id === c.assigned_branch_id)?.branch_name || 'None'}</small>
                    </div>
                    <button type="button" className="logistics-delete-btn" title="Delete courier"
                      onClick={() => handleDelete("courier", c.courier_id, c.full_name)}>
                      <Trash2 size={16} />
                    </button>
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
