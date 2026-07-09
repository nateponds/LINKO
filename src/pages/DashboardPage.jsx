import { useState, useEffect } from "react";
import { Boxes, ClipboardList, PhilippinePeso, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import "./DashboardPage.css";

/* Mock data layer — swap for /api/dashboard?range=7d later; keep the shape. */
const MOCK_STATS = {
  today: {
    revenue: 12450, orders: 8, lowStock: 3, products: 128,
    sales: [4, 7, 3, 8, 6, 9, 5, 10, 7, 6, 8, 12],
  },
  "7d": {
    revenue: 86200, orders: 47, lowStock: 3, products: 128,
    sales: [22, 31, 18, 40, 35, 52, 47, 38, 44, 50, 41, 55],
  },
  "30d": {
    revenue: 342800, orders: 213, lowStock: 3, products: 128,
    sales: [120, 145, 98, 160, 175, 140, 190, 165, 180, 210, 195, 213],
  },
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

const RECENT_ACTIVITY = [
  { id: 1, text: "Order #21374 delivered to Marielle Ocampo", time: "2 hours ago", type: "order" },
  { id: 2, text: "Stock low: Something Product Name (A2G51) — 8 left", time: "5 hours ago", type: "alert" },
  { id: 3, text: "New quote request from Sunhome Hardware Supplies", time: "Yesterday", type: "order" },
  { id: 4, text: "Out of stock: Something Product Name (AF41W)", time: "Yesterday", type: "alert" },
  { id: 5, text: "Order #21358 shipped from Manila, PH", time: "2 days ago", type: "order" },
];

const TOP_PRODUCTS = [
  { name: "Something Product Name", sku: "A2G51", sold: 64, revenue: 12800 },
  { name: "Something Product Name", sku: "AF41W", sold: 41, revenue: 8200 },
  { name: "Something Product Name", sku: "B7K02", sold: 27, revenue: 5400 },
];

const peso = (n) => `₱${n.toLocaleString("en-PH")}`;

export default function DashboardPage() {
  const [range, setRange] = useState("7d");
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiGet("/api/dashboard");
        if (cancelled) return;
        setDashboardData(data);
      } catch (e) {
        console.error(e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const stats = dashboardData || MOCK_STATS[range];
  const maxSale = Math.max(...(stats.sales || [0]));

  return (
    <AppLayout>
      <div className="dashboard-page">
        <div className="page-head">
          <h1>Dashboard</h1>
          <div className="range-toggle" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                className={range === r.key ? "active" : ""}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-icon revenue"><PhilippinePeso size={20} /></span>
            <div>
              <span className="stat-value">{peso(stats.revenue)}</span>
              <span className="stat-label">Revenue</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon orders"><ClipboardList size={20} /></span>
            <div>
              <span className="stat-value">{stats.orders}</span>
              <span className="stat-label">Orders</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon alert"><TriangleAlert size={20} /></span>
            <div>
              <span className="stat-value">{stats.lowStock}</span>
              <span className="stat-label">Low-stock Items</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon products"><Boxes size={20} /></span>
            <div>
              <span className="stat-value">{stats.products}</span>
              <span className="stat-label">Products Listed</span>
            </div>
          </div>
        </div>

        <div className="dashboard-columns">
          <section className="panel">
            <div className="panel-head">
              <h2>Sales Trend</h2>
              <span className="panel-sub">{RANGES.find((r) => r.key === range).label}</span>
            </div>
            {/* ponytail: pure-CSS bar chart, add a chart lib only if real analytics land */}
            <div className="bar-chart" aria-hidden="true">
              {stats.sales.map((v, i) => (
                <div className="bar-col" key={i}>
                  <div className="bar" style={{ height: `${(v / (maxSale || 1)) * 100}%` }} title={v} />
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Recent Activity</h2>
              <Link to="/orders" className="panel-link">View orders</Link>
            </div>
            <ul className="activity-list">
              {RECENT_ACTIVITY.map((a) => (
                <li key={a.id} className={`activity-item ${a.type}`}>
                  <span className="activity-dot" />
                  <div>
                    <span className="activity-text">{a.text}</span>
                    <span className="activity-time">{a.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Top Products</h2>
            <Link to="/inventory" className="panel-link">View inventory</Link>
          </div>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Units Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((p) => (
                <tr key={p.sku}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.sku}</td>
                  <td>{p.sold}</td>
                  <td>{peso(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppLayout>
  );
}
