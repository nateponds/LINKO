import { useState, useEffect } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
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
import DecisionStrip from "../components/DecisionStrip";
import { useAuth } from "../auth/AuthProvider";
import { apiGet } from "../lib/api";
import { Skeleton, SkeletonStatus } from "../components/ui/Skeleton";
import "./DashboardPage.css";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

const EMPTY_STATS = {
  revenue: 0,
  orders: 0,
  lowStock: 0,
  products: 0,
  sales: [],
  topProducts: [],
  recentActivity: [],
  actionableOrders: { pending: 0, accepted: 0 },
};

const ALERT_STATUSES = new Set(["cancelled", "canceled", "returned", "rejected"]);

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const peso = (value) => currency.format(value ?? 0);

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
  const verb = phrasing[status] ?? `${status} -`;
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

const ACTIVITY_PREVIEW_COUNT = 3;

function RecentActivity({ entries }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Recent activity</h2>
        <Link to="/orders" className="panel-link">View orders</Link>
      </div>
      {entries.length === 0 ? (
        <p className="panel-empty">Order updates will appear here as they happen.</p>
      ) : (
        <ol className="activity-list" id="dashboard-activity">
          {entries.map((entry, index) => (
            <li
              key={entry.order_id}
              className="activity-item"
              hidden={!expanded && index >= ACTIVITY_PREVIEW_COUNT}
            >
              <span
                aria-hidden="true"
                className={`activity-dot ${ALERT_STATUSES.has(String(entry.status).toLowerCase()) ? "is-alert" : ""}`}
              />
              <div>
                <span className="activity-text">{activityText(entry)}</span>
                <time className="activity-time" dateTime={entry.updated_at}>{timeAgo(entry.updated_at)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
      {entries.length > ACTIVITY_PREVIEW_COUNT && (
        <button
          type="button"
          className="dashboard-disclosure"
          aria-expanded={expanded}
          aria-controls="dashboard-activity"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer updates" : `Show ${entries.length - ACTIVITY_PREVIEW_COUNT} more updates`}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { activeBusinessId } = useAuth();
  const [range, setRange] = useState("7d");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const requestKey = `${activeBusinessId}:${range}:${attempt}`;
  const current = result?.key === requestKey ? result : null;
  const loading = current === null;
  const stats = current?.stats;
  const overview = snapshot?.businessId === activeBusinessId ? snapshot?.stats : null;
  const rangeLabel = RANGES.find((item) => item.key === range).label;

  useEffect(() => {
    const controller = new AbortController();
    apiGet(`/api/dashboard?range=${range}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextStats = { ...EMPTY_STATS, ...data };
        setSnapshot({ businessId: activeBusinessId, stats: nextStats });
        setResult({ key: requestKey, stats: nextStats });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: true });
      });
    return () => controller.abort();
  }, [activeBusinessId, range, requestKey]);

  return (
    <AppLayout>
      <div className="dashboard-page">
        <header className="dashboard-heading">
          <h1>Dashboard</h1>

        </header>

        {overview && (
          <section className="dashboard-work" aria-labelledby="dashboard-work-title">
            <div className="panel-head">
              <h2 id="dashboard-work-title">Orders to handle</h2>
              <Link to="/orders" className="panel-link">All orders</Link>
            </div>
            <DecisionStrip
              label="Incoming orders that need action"
              items={[
                {
                  key: "pending",
                  to: "/orders?status=Pending",
                  value: overview.actionableOrders.pending,
                  label: "Awaiting a decision",
                  hint: "Review incoming orders",
                  empty: "No orders to accept or reject",
                },
                {
                  key: "accepted",
                  to: "/orders?status=Accepted",
                  value: overview.actionableOrders.accepted,
                  label: "Ready to prepare",
                  hint: "Start preparing accepted orders",
                  empty: "No accepted orders to prepare",
                },
              ]}
            />
          </section>
        )}

        <section className="dashboard-performance" aria-labelledby="dashboard-performance-title" aria-busy={loading}>
          <div className="panel-head performance-head">
            <h2 id="dashboard-performance-title">Sales performance</h2>
            <div className="range-toggle" role="group" aria-label="Sales time range">
              {RANGES.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  aria-pressed={range === item.key}
                  onClick={() => setRange(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <SkeletonStatus label="Loading dashboard data">
              <Skeleton width="100%" height={62} />
              <div className="dashboard-columns dashboard-loading">
                <Skeleton width="100%" height={220} />
                <Skeleton width="100%" height={220} />
              </div>
            </SkeletonStatus>
          )}
          {current?.error && (
            <div className="dashboard-error" role="alert">
              <TriangleAlert size={20} aria-hidden="true" />
              <div>
                <strong>{overview ? "Sales data couldn’t load" : "Dashboard couldn’t load"}</strong>
                <p>Try again to refresh your orders and sales.</p>
              </div>
              <button type="button" onClick={() => setAttempt((previous) => previous + 1)}>Try again</button>
            </div>
          )}

          {stats && (
            <>
              <dl className="stat-grid">
                <div><dt>Invoiced revenue</dt><dd>{peso(stats.revenue)}</dd></div>
                <div><dt>Orders placed</dt><dd>{stats.orders.toLocaleString("en-PH")}</dd></div>
              </dl>

              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-head">
                    <h3>Order volume</h3>
                    <span className="panel-sub">{rangeLabel}</span>
                  </div>
                  {stats.sales.some(({ value }) => value > 0) ? (
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={stats.sales} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke="#e5e9ef" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#52617d" }} minTickGap={28} dy={6} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#52617d" }} width={34} />
                          <Tooltip content={<SalesTooltip />} cursor={{ stroke: "#c4cfe2" }} />
                          <Area type="linear" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="var(--color-primary)" fillOpacity={0.1} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="panel-empty">No orders were placed in this period.</p>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-head"><h3>Top products by units sold</h3></div>
                  {stats.topProducts.length === 0 ? (
                    <p className="panel-empty">No product sales to rank in this period.</p>
                  ) : (
                    <table className="dashboard-table" aria-label="Top products by units sold">
                      <thead><tr><th scope="col">Product</th><th scope="col">Units</th><th scope="col">Order value</th></tr></thead>
                      <tbody>
                        {stats.topProducts.map((product) => (
                          <tr key={`${product.name}-${product.sku}`}>
                            <th scope="row">
                              {product.name}
                              {product.sku && <small>{product.sku}</small>}
                            </th>
                            <td>{product.sold.toLocaleString("en-PH")}</td>
                            <td>{peso(product.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              </div>
            </>
          )}
        </section>

        {overview && (
          <div className="dashboard-columns dashboard-secondary">
            <RecentActivity key={activeBusinessId} entries={overview.recentActivity} />
            <section className="panel">
              <div className="panel-head">
                <h2>Inventory</h2>
                <Link to="/inventory" className="panel-link">View inventory</Link>
              </div>
              <dl className="stat-grid">
                <div><dt>Products listed</dt><dd>{overview.products.toLocaleString("en-PH")}</dd></div>
                <div><dt>Below 10 in stock</dt><dd className={overview.lowStock > 0 ? "stat-warning" : undefined}>{overview.lowStock.toLocaleString("en-PH")}</dd></div>
              </dl>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
