import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { apiGet, apiSend } from "../lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function LogisticsManagementPage() {
  const [branches, setBranches] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingBranch, setSubmittingBranch] = useState(false);
  const [submittingCourier, setSubmittingCourier] = useState(false);
  const [branchError, setBranchError] = useState(null);
  const [courierError, setCourierError] = useState(null);

  // Form states
  const [newBranch, setNewBranch] = useState({
    branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: ""
  });
  const [newCourier, setNewCourier] = useState({
    full_name: "", phone_number: "", vehicle_type: "", assigned_branch_id: ""
  });

  const fetchData = async () => Promise.all([
    apiGet("/api/branches"),
    apiGet("/api/couriers")
  ]);

  const refreshData = async () => {
    try {
      const [b, c] = await fetchData();
      setBranches(b);
      setCouriers(c);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [b, c] = await fetchData();
        if (cancelled) return;
        setBranches(b);
        setCouriers(c);
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

  return (
    <AppLayout>
      <div className="logistics-page">
        <h1 style={{ marginBottom: '2rem' }}>Logistics Management</h1>

        {loading ? <p>Loading...</p> : error ? <p style={{color: 'red'}}>{error}</p> : (
          <div className="logistics-grid">

            {/* Branches Section */}
            <div>
              <h2>Branches</h2>
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
              <h2>Couriers</h2>
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

          </div>
        )}
      </div>
    </AppLayout>
  );
}
