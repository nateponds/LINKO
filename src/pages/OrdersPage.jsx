import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import "./OrdersPage.css";

/* Mock data layer — swap for GET /api/orders later; keep the shape.
   Tracking #21374 resolves on the Invoice page's mock DB, so that row
   demonstrates the full orders → invoice tracking flow. */
const MOCK_ORDERS = [
  { trackingNo: "21374", customer: "Marielle Ocampo", seller: "Sunhome Hardware Supplies", date: "23 Jun 2026", items: 4, total: 5230, status: "Delivered" },
  { trackingNo: "21358", customer: "Joseph Ramirez", seller: "Cebu Metro Distributors", date: "21 Jun 2026", items: 2, total: 1890, status: "In Transit" },
  { trackingNo: "21344", customer: "Ana Villanueva", seller: "Sunhome Hardware Supplies", date: "20 Jun 2026", items: 7, total: 10450, status: "Processing" },
  { trackingNo: "21329", customer: "Carlo Mendoza", seller: "Golden Grain Trading", date: "18 Jun 2026", items: 1, total: 640, status: "Delivered" },
  { trackingNo: "21311", customer: "Bea Santos", seller: "Cebu Metro Distributors", date: "15 Jun 2026", items: 3, total: 3120, status: "Cancelled" },
  { trackingNo: "21298", customer: "Miguel Torres", seller: "Golden Grain Trading", date: "12 Jun 2026", items: 5, total: 7800, status: "Delivered" },
];

const STATUS_TABS = ["All", "Processing", "In Transit", "Delivered", "Cancelled"];

const statusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");
const peso = (n) => `₱${n.toLocaleString("en-PH")}`;

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const visibleOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return MOCK_ORDERS.filter((o) => {
      if (statusFilter !== "All" && o.status !== statusFilter) return false;
      return (
        !term ||
        o.trackingNo.includes(term) ||
        o.customer.toLowerCase().includes(term) ||
        o.seller.toLowerCase().includes(term)
      );
    });
  }, [statusFilter, searchTerm]);

  return (
    <AppLayout>
      <div className="orders-page">
        <div className="page-head">
          <h1>Orders</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search tracking no., customer, seller"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-icon-btn" aria-label="Search"><Search size={16} /></button>
          </div>
        </div>

        <div className="status-tabs" role="tablist" aria-label="Filter by status">
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
          {visibleOrders.length === 0 ? (
            <div className="page-empty">No orders match your search.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tracking No.</th>
                  <th>Customer</th>
                  <th>Seller</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => (
                  <tr key={o.trackingNo}>
                    <td>#{o.trackingNo}</td>
                    <td><strong>{o.customer}</strong></td>
                    <td>{o.seller}</td>
                    <td>{o.date}</td>
                    <td>{o.items}</td>
                    <td>{peso(o.total)}</td>
                    <td><span className={`status ${statusClass(o.status)}`}>{o.status}</span></td>
                    <td>
                      <Link className="track-link" to={`/invoices?tracking=${o.trackingNo}`}>
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
