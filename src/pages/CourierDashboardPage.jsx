import { useEffect, useState } from "react";
import { Search, MapPin, Package } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet, apiSend } from "../lib/api";
import { statusClass, shortDate } from "../lib/format";
import "./LogisticsPage.css";

export default function CourierDashboardPage() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadParcels = async () => {
    try {
      const data = await apiGet("/api/parcels");
      setParcels(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParcels();
  }, []);

  const handleQuickAction = async (parcelId, statusUpdate, e) => {
    e.preventDefault(); // Prevent navigating to detail page
    try {
      await apiSend(`/api/parcels/${parcelId}/tracking`, {
        body: { status_update: statusUpdate, remarks: "Quick action from dashboard" }
      });
      loadParcels();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const visibleParcels = parcels.filter(p => {
    const term = searchTerm.toLowerCase();
    return !term || 
      p.parcel_id.toLowerCase().includes(term) ||
      p.receiver.business_name.toLowerCase().includes(term);
  });

  return (
    <AppLayout>
      <div className="logistics-page">
        <div className="page-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h1>Courier Dashboard</h1>
            <p style={{ color: 'var(--gray-600)' }}>Manage your deliveries and pickups</p>
          </div>
          <div className="search-bar" style={{ width: '100%', maxWidth: '100%' }}>
            <input
              type="text"
              placeholder="Search parcel no. or receiver"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-icon-btn" aria-label="Search">
              <Search size={16} />
            </button>
          </div>
        </div>

        <main className="courier-list">
          {loading ? (
            <div className="page-empty">Loading assignments...</div>
          ) : error ? (
            <div className="page-empty">Could not load assignments: {error}</div>
          ) : visibleParcels.length === 0 ? (
            <div className="page-empty">No assignments found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {visibleParcels.map(p => (
                <Link to={`/logistics/${p.parcel_id}`} key={p.parcel_id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--gray-200)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.1rem' }}>#{p.parcel_id}</strong>
                      <span className={`status ${statusClass(p.current_status)}`}>{p.current_status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--gray-700)' }}>
                      <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong>To:</strong> {p.receiver.business_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <Package size={14} />
                      <span>{p.weight_kg} kg • ETA: {shortDate(p.estimated_delivery_date)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {p.current_status === 'Order Created' && (
                        <button
                          onClick={(e) => handleQuickAction(p.parcel_id, 'Picked Up', e)}
                          style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--brand-600)', background: 'white', color: 'var(--brand-600)', cursor: 'pointer', flex: 1 }}
                        >
                          Pick Up
                        </button>
                      )}
                      {['Picked Up', 'In Transit'].includes(p.current_status) && (
                        <button
                          onClick={(e) => handleQuickAction(p.parcel_id, 'Out for Delivery', e)}
                          style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--brand-600)', background: 'white', color: 'var(--brand-600)', cursor: 'pointer', flex: 1 }}
                        >
                          Out for Delivery
                        </button>
                      )}
                      {p.current_status === 'Out for Delivery' && (
                        <button
                          onClick={(e) => handleQuickAction(p.parcel_id, 'Delivered', e)}
                          style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', background: 'var(--brand-600)', color: 'white', cursor: 'pointer', flex: 1 }}
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
