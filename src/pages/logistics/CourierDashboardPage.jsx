import { useEffect, useState } from "react";
import { Search, MapPin, Package } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { apiGet, apiSend } from "../../lib/api";
import { statusClass, shortDate } from "../../lib/format";
import { allowedNext, ONE_TAP_REMARKS, FAIL_REASONS } from "../../lib/statusWorkflow";
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

  // Which parcel is showing the Delivery Failed reason pick-list.
  const [failingParcelId, setFailingParcelId] = useState(null);

  const handleQuickAction = async (parcelId, statusUpdate, e, remarks) => {
    e.preventDefault(); // Prevent navigating to detail page

    // Delivery Failed needs a canned reason first — swap the card's buttons
    // for the reason pick-list (still one tap per action, no free text).
    if (statusUpdate === "Delivery Failed" && remarks === undefined) {
      setFailingParcelId(parcelId);
      return;
    }
    setFailingParcelId(null);

    // Delivered/Returned and branch checkpoints send no remark: the backend
    // generates the proof of delivery / branch-name remark from accounts.
    const body = { status_update: statusUpdate };
    if (remarks ?? ONE_TAP_REMARKS[statusUpdate]) {
      body.remarks = remarks ?? ONE_TAP_REMARKS[statusUpdate];
    }

    try {
      await apiSend(`/api/parcels/${parcelId}/tracking`, { body });
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
          {failingParcelId === p.parcel_id
            ? FAIL_REASONS.map((reason) => (
                <button
                  key={reason}
                  className="courier-action"
                  onClick={(e) => handleQuickAction(p.parcel_id, "Delivery Failed", e, reason)}
                >
                  {reason}
                </button>
              ))
            : allowedNext(p.current_status, p.failed_attempts).map((status) => (
                <button
                  key={status}
                  className={status === "Delivered" ? "courier-action-primary" : "courier-action"}
                  onClick={(e) => handleQuickAction(p.parcel_id, status, e)}
                >
                  {status}
                </button>
              ))}
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
