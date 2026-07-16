import { useState, useEffect } from "react";
import { Boxes, ClipboardList, PhilippinePeso, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import "./DashboardPage.css";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

const EMPTY_STATS = {
  revenue: 0,
  orders: 0,
  lowStock: 0,
  products: 0,
  sales: [],
  topProducts: [],
  recentActivity: [],
};

const ALERT_STATUSES = new Set(["cancelled", "canceled", "returned", "rejected"]);

const peso = (n) => `₱${Number(n ?? 0).toLocaleString("en-PH")}`;

function timeAgo(timestamp) {
  const seconds = Math.max(0, (Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function activityText(entry) {
  const status = String(entry.status ?? "").toLowerCase();
  const phrasing = {
    pending: "placed by",
    accepted: "accepted for",
    preparing: "being prepared for",
    shipped: "shipped to",
    delivered: "delivered to",
    returned: "returned by",
    cancelled: "cancelled by",
  };
  const verb = phrasing[status] ?? `${status} —`;
  return `Order #${entry.order_id} ${verb} ${entry.buyer_business_name}`;
}

function SalesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{label}</span>
      <span className="chart-tooltip-value">
        <span className="chart-tooltip-swatch" />
        {payload[0].value} order{payload[0].value === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState("7d");
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet(`/api/dashboard?range=${range}`);
        if (cancelled) return;
        setStats({ ...EMPTY_STATS, ...data });
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [range]);

  const rangeLabel = RANGES.find((r) => r.key === range).label;

  return (
    <AppLayout>
      <div className="dashboard-page" aria-busy={loading}>
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

        {error && (
          <p className="dashboard-error">Could not load dashboard: {error}</p>
        )}

        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-icon revenue"><PhilippinePeso size={26} /></span>
            <div>
              <span className="stat-value">{peso(stats.revenue)}</span>
              <span className="stat-label">Revenue · {rangeLabel}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon orders"><ClipboardList size={26} /></span>
            <div>
              <span className="stat-value">{stats.orders}</span>
              <span className="stat-label">Orders · {rangeLabel}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon alert"><TriangleAlert size={26} /></span>
            <div>
              <span className="stat-value">{stats.lowStock}</span>
              <span className="stat-label">Low-stock Items</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon products"><Boxes size={26} /></span>
            <div>
              <span className="stat-value">{stats.products}</span>
              <span className="stat-label">Products Listed</span>
            </div>
          </div>
        </div>

        <div className="dashboard-columns">
          <section className="panel">
            <div className="panel-head">
              <h2>Orders Trend</h2>
              <span className="panel-sub">{rangeLabel}</span>
            </div>
            {stats.sales.length === 0 ? (
              <p className="panel-empty">No orders in this period yet.</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={stats.sales}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#eceff5" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#52617d" }}
                      minTickGap={28}
                      dy={6}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "#52617d" }}
                      width={36}
                    />
                    <Tooltip
                      content={<SalesTooltip />}
                      cursor={{ stroke: "#c4cfe2", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      strokeLinecap="round"
                      fill="var(--color-primary)"
                      fillOpacity={0.1}
                      dot={false}
                      activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Recent Activity</h2>
              <Link to="/orders" className="panel-link">View orders</Link>
            </div>
            {stats.recentActivity.length === 0 ? (
              <p className="panel-empty">No order activity yet.</p>
            ) : (
              <ul className="activity-list">
                {stats.recentActivity.map((entry) => (
                  <li
                    key={entry.order_id}
                    className={`activity-item ${
                      ALERT_STATUSES.has(String(entry.status).toLowerCase())
                        ? "alert"
                        : "order"
                    }`}
                  >
                    <span className="activity-dot" />
                    <div>
                      <span className="activity-text">{activityText(entry)}</span>
                      <span className="activity-time">{timeAgo(entry.updated_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Top Products · {rangeLabel}</h2>
            <Link to="/inventory" className="panel-link">View inventory</Link>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="panel-empty">No products sold in this period yet.</p>
          ) : (
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
                {stats.topProducts.map((p) => (
                  <tr key={`${p.name}-${p.sku}`}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.sku ?? "—"}</td>
                    <td>{p.sold}</td>
                    <td>{peso(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
