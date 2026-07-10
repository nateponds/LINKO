import { useEffect, useState } from "react";
import { Search, MapPin, Package } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { apiGet, apiSend } from "../../lib/api";
import { statusClass, shortDate } from "../../lib/format";
import "./logistics.css";

const TERMINAL_STATUSES = ["Delivered", "Returned", "Cancelled"];

export default function CourierDashboardPage() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchParcels = async () => apiGet("/api/parcels");

  const refreshParcels = async () => {
    try {
      const data = await fetchParcels();
      setParcels(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchParcels();
        if (!cancelled) setParcels(data);
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

  const handleQuickAction = async (parcelId, statusUpdate, e) => {
    e.preventDefault(); // Prevent navigating to detail page
    try {
      await apiSend(`/api/parcels/${parcelId}/tracking`, {
        body: { status_update: statusUpdate, remarks: "Quick action from dashboard" },
      });
      refreshParcels();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const visibleParcels = parcels.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      !term ||
      p.parcel_id.toLowerCase().includes(term) ||
      p.receiver.business_name.toLowerCase().includes(term)
    );
  });
  const isTerminal = (parcel) => TERMINAL_STATUSES.includes(parcel.current_status);
  const parcelGroups = [
    {
      title: "Available at my branch",
      parcels: visibleParcels.filter(
        (parcel) => parcel.latest_courier_id === null && !isTerminal(parcel),
      ),
    },
    {
      title: "My active parcels",
      // We do not have the logged-in courier_id on this page. After a handoff,
      // the previous courier still sees the parcel here via history until it
      // reaches a terminal status.
      parcels: visibleParcels.filter(
        (parcel) => parcel.latest_courier_id !== null && !isTerminal(parcel),
      ),
    },
    {
      title: "Completed",
      parcels: visibleParcels.filter(isTerminal),
    },
  ];

  const renderParcelCard = (p) => (
    <Link to={`/logistics/${p.parcel_id}`} key={p.parcel_id} className="parcel-card-link">
      <div className="parcel-card">
        <div className="parcel-card-header">
          <strong className="parcel-card-id">#{p.parcel_id}</strong>
          <span className={`status ${statusClass(p.current_status)}`}>{p.current_status}</span>
        </div>
        <div className="parcel-card-receiver">
          <MapPin size={16} className="parcel-card-icon" />
          <div>
            <strong>To:</strong> {p.receiver.business_name}
          </div>
        </div>
        <div className="parcel-card-meta">
          <Package size={14} />
          <span>{p.weight_kg} kg - ETA: {shortDate(p.estimated_delivery_date)}</span>
        </div>
        <div className="parcel-card-actions">
          {p.current_status === "Order Created" && (
            <button
              className="courier-action"
              onClick={(e) => handleQuickAction(p.parcel_id, "Picked Up", e)}
            >
              Pick Up
            </button>
          )}
          {["Picked Up", "In Transit"].includes(p.current_status) && (
            <button
              className="courier-action"
              onClick={(e) => handleQuickAction(p.parcel_id, "Out for Delivery", e)}
            >
              Out for Delivery
            </button>
          )}
          {p.current_status === "Out for Delivery" && (
            <>
              <button
                className="courier-action"
                onClick={(e) => handleQuickAction(p.parcel_id, "Returned", e)}
              >
                Mark Returned
              </button>
              <button
                className="courier-action-primary"
                onClick={(e) => handleQuickAction(p.parcel_id, "Delivered", e)}
              >
                Mark Delivered
              </button>
            </>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <AppLayout>
      <div className="logistics-page">
        <div className="page-head courier-page-head">
          <div className="page-head-intro">
            <h1>Courier Dashboard</h1>
            <p className="page-head-subtitle">Manage pickups, delivery progress, and returns</p>
          </div>
          <div className="search-bar courier-search-bar">
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
            <div className="parcel-list-container">
              {parcelGroups.map((group) => (
                <section className="courier-section" key={group.title}>
                  <div className="courier-section-head">
                    <h2>{group.title}</h2>
                    <span>{group.parcels.length}</span>
                  </div>
                  {group.parcels.length ? (
                    group.parcels.map(renderParcelCard)
                  ) : (
                    <div className="courier-section-empty">No parcels in this section.</div>
                  )}
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
