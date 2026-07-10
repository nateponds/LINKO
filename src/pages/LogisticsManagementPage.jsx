import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { apiGet, apiSend } from "../lib/api";
import { Plus } from "lucide-react";

export default function LogisticsManagementPage() {
  const [branches, setBranches] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await apiSend("/api/branches", { body: newBranch });
      setNewBranch({ branch_name: "", contact_number: "", province: "", city_municipality: "", barangay: "", street_address: "", postal_code: "" });
      refreshData();
    } catch (err) {
      alert("Failed to add branch: " + err.message);
    }
  };

  const handleAddCourier = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newCourier };
      if (!payload.assigned_branch_id) delete payload.assigned_branch_id;
      else payload.assigned_branch_id = Number(payload.assigned_branch_id);
      
      await apiSend("/api/couriers", { body: payload });
      setNewCourier({ full_name: "", phone_number: "", vehicle_type: "", assigned_branch_id: "" });
      refreshData();
    } catch (err) {
      alert("Failed to add courier: " + err.message);
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Logistics Management</h1>
        
        {loading ? <p>Loading...</p> : error ? <p style={{color: 'red'}}>{error}</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* Branches Section */}
            <div>
              <h2>Branches</h2>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
                <form onSubmit={handleAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="text" placeholder="Branch Name" required value={newBranch.branch_name} onChange={e => setNewBranch({...newBranch, branch_name: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Contact Number" required value={newBranch.contact_number} onChange={e => setNewBranch({...newBranch, contact_number: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Province" required value={newBranch.province} onChange={e => setNewBranch({...newBranch, province: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="City" required value={newBranch.city_municipality} onChange={e => setNewBranch({...newBranch, city_municipality: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Barangay" value={newBranch.barangay} onChange={e => setNewBranch({...newBranch, barangay: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Street Address" value={newBranch.street_address} onChange={e => setNewBranch({...newBranch, street_address: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Postal Code" value={newBranch.postal_code} onChange={e => setNewBranch({...newBranch, postal_code: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--brand-600)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    <Plus size={16} /> Add Branch
                  </button>
                </form>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {branches.map(b => (
                  <li key={b.branch_id} style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                    <strong>{b.branch_name}</strong> - {b.contact_number}<br/>
                    <small style={{ color: 'var(--gray-500)' }}>{b.city_municipality}, {b.province}</small>
                  </li>
                ))}
              </ul>
            </div>

            {/* Couriers Section */}
            <div>
              <h2>Couriers</h2>
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
                <form onSubmit={handleAddCourier} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="text" placeholder="Full Name" required value={newCourier.full_name} onChange={e => setNewCourier({...newCourier, full_name: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Phone Number" required value={newCourier.phone_number} onChange={e => setNewCourier({...newCourier, phone_number: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="text" placeholder="Vehicle Type (e.g. Van, Motorcycle)" value={newCourier.vehicle_type} onChange={e => setNewCourier({...newCourier, vehicle_type: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <select value={newCourier.assigned_branch_id} onChange={e => setNewCourier({...newCourier, assigned_branch_id: e.target.value})} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">-- Assign to Branch (Optional) --</option>
                    {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                  </select>
                  <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--brand-600)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    <Plus size={16} /> Add Courier
                  </button>
                </form>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {couriers.map(c => (
                  <li key={c.courier_id} style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                    <strong>{c.full_name}</strong> - {c.phone_number}<br/>
                    <small style={{ color: 'var(--gray-500)' }}>{c.vehicle_type} • Branch: {branches.find(b => b.branch_id === c.assigned_branch_id)?.branch_name || 'None'}</small>
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
