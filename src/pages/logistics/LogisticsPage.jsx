import { useEffect, useMemo, useState } from "react";
import { Search, PackagePlus } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { useAuth } from "../../auth/AuthProvider";
import { peso, shortDate, statusClass } from "../../lib/format";
import "./logistics.css";

/* Course-deliverable demo surface (Sprint 2-CD): parcel list backed by
   GET /api/parcels — the first page wired to the live backend. */

const STATUS_TABS = [
  "All",
  "Order Created",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Returned",
  "Cancelled",
];

export default function LogisticsPage() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const { hasAnyRole } = useAuth();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/parcels")
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setParcels(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleParcels = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return parcels.filter((p) => {
      if (statusFilter !== "All" && p.current_status !== statusFilter)
        return false;
      return (
        !term ||
        p.parcel_id.toLowerCase().includes(term) ||
        p.sender.business_name.toLowerCase().includes(term) ||
        p.receiver.business_name.toLowerCase().includes(term)
      );
    });
  }, [parcels, statusFilter, searchTerm]);

  return (
    <AppLayout>
      <div className="logistics-page">
        <div className="page-head">
          <h1>Logistics</h1>
          <div className="logistics-head-actions">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search parcel no., sender, receiver"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-icon-btn" aria-label="Search">
                <Search size={16} />
              </button>
            </div>
            {hasAnyRole(["logistics_coordinator", "platform_admin"]) && (
              <Link className="book-parcel-btn" to="/logistics/management">
                <PackagePlus size={16} /> Manage
              </Link>
            )}
          </div>
        </div>

        <div
          className="status-tabs"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={statusFilter === tab}
              className={statusFilter === tab ? "active" : ""}
              onClick={() => setStatusFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <main className="table-card">
          {loading ? (
            <div className="page-empty">Loading parcels…</div>
          ) : error ? (
            <div className="page-empty">
              Could not load parcels: {error}
            </div>
          ) : visibleParcels.length === 0 ? (
            <div className="page-empty">No parcels match your search.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parcel No.</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Tier</th>
                  <th>Weight</th>
                  <th>Shipping Fee</th>
                  <th>ETA</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleParcels.map((p) => (
                  <tr key={p.parcel_id}>
                    <td>#{p.parcel_id}</td>
                    <td>
                      <strong>{p.sender.business_name}</strong>
                    </td>
                    <td>{p.receiver.business_name}</td>
                    <td>{p.tier_name}</td>
                    <td>{p.weight_kg} kg</td>
                    <td>{peso(p.shipping_fee)}</td>
                    <td>{shortDate(p.estimated_delivery_date)}</td>
                    <td>
                      <span
                        className={`status ${statusClass(p.current_status)}`}
                      >
                        {p.current_status ?? "—"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="track-link"
                        to={`/logistics/${p.parcel_id}`}
                      >
                        Track
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
