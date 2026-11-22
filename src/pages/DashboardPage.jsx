import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  DollarSign,
  ShoppingCart,
  Package,
  Cube,
  Clock,
  CheckCircle,
  TriangleAlert,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Line,
} from "recharts";
import AppLayout from "../layouts/AppLayout";
import DecisionStrip from "../components/DecisionStrip";
import { useAuth } from "../auth/AuthProvider";
import { apiGet } from "../lib/api";
import { Skeleton, SkeletonStatus } from "../components/ui/Skeleton";

import "./DashboardPage.css";

const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
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
  revenueTrend: [],
  categoryRevenue: [],
  topCustomers: [],
};

const ALERT_STATUSES = new Set(["cancelled", "canceled", "returned", "rejected"]);

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const pesoFormat = (value) => currency.format(value ?? 0);

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

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{label}</span>
      <span className="chart-tooltip-value">
        <span className="chart-tooltip-swatch" />
        {pesoFormat(payload[0].value)}
      </span>
    </div>
  );
}

function CategoryDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const colors = ["#2563eb", "#059669", "#d97706", "#db2777", "#1d4ed8", "#16a34a", "#b45309", "#be185d"];

  return (
    <div className="category-panel-wrapper">
      <div className="chart-wrap chart-wrap-category">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              dataKey="value"
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={75}
              outerRadius={110}
              paddingAngle={3}
              isAnimationActive={false}
              startAngle={90}
              endAngle={450}
            >
              {data.map((entry, index) => {
                return (
                  <Cell key={`category-${entry.name}`} fill={colors[index % colors.length]} />
                );
              })}
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                  return (
                    <div className="chart-tooltip">
                      <span className="chart-tooltip-label">{label}</span>
                      <span className="chart-tooltip-value">
                        <span className="chart-tooltip-swatch" />
                        {pesoFormat(item.value)}
                      </span>
                      <span className="chart-tooltip-sub">{pct}% of total revenue</span>
                    </div>
                  );
                }}
                cursor={{ stroke: "#c4cfe2", fill: "rgba(0,0,0,0.02)" }}
                offset={16}
                position={{ x: 0, y: 0 }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-center-label">Total Revenue</span>
          <span className="donut-center-value">{pesoFormat(total)}</span>
          <span className="donut-center-sub">{data.length} categor{data.length === 1 ? "y" : "ies"}</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((entry, index) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
          return (
            <div
              key={entry.name}
              className="chart-legend-item"
              data-legend-index={index}
            >
              <span className="chart-legend-swatch" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="chart-legend-name">{entry.name}</span>
              <div className="chart-legend-meta">
                <span className="chart-legend-value">{pesoFormat(entry.value)}</span>
                <span className="chart-legend-pct">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopCustomers({ data }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, c) => sum + c.value, 0);
  const max = sorted.length > 0 ? Math.max(...sorted.map((c) => c.value)) : 0;

  if (sorted.length === 0 || total === 0) {
    return <p className="panel-empty">No customer revenue data in this period.</p>;
  }

  return (
    <div className="top-customers-list">
      {sorted.map((customer, index) => {
        const rank = index + 1;
        const percent = max > 0 ? Math.round((customer.value / max) * 100) : 0;
        const sharePct = total > 0 ? ((customer.value / total) * 100).toFixed(1) : 0;
        const isTop3 = rank <= 3;
        const isTop1 = rank === 1;
        return (
          <div key={customer.name || index} className={`top-customer-row${isTop3 ? " top3" : ""}${isTop1 ? " top1" : ""}`}>
            <span className={`top-customer-rank${isTop3 ? ` top3-rank rank-${rank}` : ""}`}>#{rank}</span>
            <span className="top-customer-name">{customer.name}</span>
            <div className="top-customer-bar-wrap">
              <div className="top-customer-bar-track" />
              <div className="top-customer-bar" style={{ width: percent + "%" }} />
            </div>
            <span className="top-customer-value">
              {pesoFormat(customer.value)}
              <span className="top-customer-share">({sharePct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ACTIVITY_PREVIEW_COUNT = 3;

function RecentActivity({ entries }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="panel panel-recent-activity">
      <div className="panel-head">
        <h2>Recent activity</h2>
        <Link to="/orders" className="panel-link">View orders</Link>
      </div>
      <div className="panel-body">
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
      </div>
    </section>
  );
}

const STAT_ICONS = {
  revenue: DollarSign,
  orders: ShoppingCart,
  products: Cube,
  lowStock: Package,
  alert: Clock,
  active: CheckCircle,
  warning: Package,
  ok: CheckCircle,
};

function StatCard({ label, value, sub, status, trend, comparison }) {
  const Icon = STAT_ICONS[status];
  return (
    <section className={`stat-card ${status || ""}`}>
      <div className="stat-card-header">
        <div className="stat-card-label-wrap">
          <dt className="stat-card-label">{label}</dt>
          {Icon && <span className="stat-card-icon" aria-hidden="true"><Icon size={14} /></span>}
        </div>
        {comparison !== undefined && (
          <span className={`stat-card-comparison ${comparison >= 0 ? "positive" : "negative"}`}>
            {comparison >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{comparison >= 0 ? "+" : ""}{comparison.toFixed(1)}%</span>
          </span>
        )}
      </div>
      <div className="stat-card-divider" />
      <dd className="stat-card-value">{value}</dd>
      {sub && <span className="stat-card-sub">{sub}</span>}
      {trend && <span className="stat-card-trend">{trend}</span>}
    </section>
  );
}

export default function DashboardPage() {
  const { activeBusiness, activeBusinessId, activeRoles } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const requestKey = `${activeBusinessId}:${range}:${attempt}`;
  const current = result?.key === requestKey ? result : null;
  const loading = current === null;
  const stats = current?.stats;
  const overview = snapshot?.businessId === activeBusinessId ? snapshot?.stats : null;
  const rangeLabel = RANGES.find((item) => item.key === range).label;
  const businessName = activeBusiness?.business_name || "Your business";

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

  const fetchLowStockProducts = useCallback(async () => {
    if (!activeBusinessId) return;
    setLowStockLoading(true);
    try {
      const data = await apiGet(
        `/api/products?business_id=${activeBusinessId}&stock_status=low_stock&limit=8`,
      );
      setLowStockProducts(Array.isArray(data.items) ? data.items : []);
    } catch {
      setLowStockProducts([]);
    } finally {
      setLowStockLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    const load = async () => {
      await fetchLowStockProducts();
    };
    if (overview) load();
  }, [overview, fetchLowStockProducts]);

  const pendingCount = overview?.actionableOrders?.pending ?? 0;
  const acceptedCount = overview?.actionableOrders?.accepted ?? 0;

  // Calculate period-over-period comparisons (mock for now - would come from API in production)
  const comparisons = useMemo(() => {
    if (!stats || !overview) return {};
    const prevRevenue = stats.revenueTrend?.[0]?.value || 0;
    const currRevenue = overview.revenue;
    const revenueChange = prevRevenue > 0 ? ((currRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    
    const prevOrders = stats.sales?.[0]?.value || 0;
    const currOrders = overview.orders;
    const ordersChange = prevOrders > 0 ? ((currOrders - prevOrders) / prevOrders) * 100 : 0;
    
    return {
      revenue: revenueChange,
      orders: ordersChange,
    };
  }, [stats, overview]);

  return (
    <AppLayout>
      <div className="dashboard-page">
        {/* Hero header */}
        <header className="dashboard-hero">
          <div className="hero-content">
            <div className="hero-meta">
              <span className="role-badge">{activeRoles.includes("wholesaler") ? "Seller" : ""}</span>
              <span className="hero-divider">{businessName}</span>
            </div>
            <h1>Dashboard</h1>
            <p className="hero-sub">
              Overview of {businessName}'s sales and operations for <span className="range-text">{rangeLabel}</span>.
            </p>
          </div>
          <div className="hero-range">
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
        </header>

        {overview && (
          <>
            {/* Section divider */}
            <div className="section-divider" />

            {/* KPI stat cards */}
            <section className="dashboard-kpis" aria-labelledby="dashboard-kpis-title">
              <h2 className="visually-hidden" id="dashboard-kpis-title">Key metrics</h2>
              <div className="stat-grid">
                <StatCard
                  label="Invoiced revenue"
                  value={pesoFormat(overview.revenue)}
                  sub="This period"
                  status="revenue"
                  trend={overview.revenue > 0 ? "Up from last period" : undefined}
                  comparison={comparisons.revenue}
                />
                <StatCard
                  label="Orders placed"
                  value={overview.orders.toLocaleString("en-PH")}
                  sub={rangeLabel}
                  status="orders"
                  comparison={comparisons.orders}
                />
                <StatCard
                  label="Low stock items"
                  value={overview.lowStock.toLocaleString("en-PH")}
                  sub={overview.lowStock > 0 ? "Below 10 units" : "All stocked"}
                  status={overview.lowStock > 0 ? "warning" : "ok"}
                />
                <StatCard
                  label="Products listed"
                  value={overview.products.toLocaleString("en-PH")}
                  sub="In your catalog"
                  status="products"
                />
                <StatCard
                  label="Awaiting decision"
                  value={pendingCount.toLocaleString("en-PH")}
                  sub={pendingCount > 0 ? "Review incoming orders" : "All caught up"}
                  status={pendingCount > 0 ? "alert" : "ok"}
                  trend={pendingCount > 0 ? "Needs attention" : undefined}
                />
                <StatCard
                  label="Ready to prepare"
                  value={acceptedCount.toLocaleString("en-PH")}
                  sub={acceptedCount > 0 ? "Start preparing orders" : "No active orders"}
                  status={acceptedCount > 0 ? "active" : "ok"}
                  trend={acceptedCount > 0 ? "In progress" : undefined}
                />
              </div>
            </section>

            {/* Section divider */}
            <div className="section-divider" />

            {/* Needs your attention */}
            <section className="dashboard-attention" aria-labelledby="dashboard-attention-title">
              <div className="panel-head attention-head">
                <div className="attention-head-label">
                  <span className="attention-badge" aria-hidden="true">!</span>
                  <h2 id="dashboard-attention-title">Needs your attention</h2>
                </div>
                <Link to="/orders" className="panel-link">All orders</Link>
              </div>
              <DecisionStrip
                label="Incoming orders that need action"
                items={[
                  {
                    key: "pending",
                    to: "/orders?status=Pending",
                    value: pendingCount,
                    label: "Awaiting a decision",
                    hint: pendingCount > 0 ? `${pendingCount} order${pendingCount === 1 ? "" : "s"} to accept or reject` : "No orders to accept or reject",
                    empty: "No orders to accept or reject",
                  },
                  {
                    key: "accepted",
                    to: "/orders?status=Accepted",
                    value: acceptedCount,
                    label: "Ready to prepare",
                    hint: acceptedCount > 0 ? `${acceptedCount} order${acceptedCount === 1 ? "" : "s"} to prepare` : "No accepted orders to prepare",
                    empty: "No accepted orders to prepare",
                  },
                ]}
              />
            </section>

            {/* Section divider */}
            <div className="section-divider" />

            {/* Main dashboard grid */}
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
                    <strong>{overview ? "Sales data couldn't load" : "Dashboard couldn't load"}</strong>
                    <p>Try again to refresh your orders and sales.</p>
                  </div>
                  <button type="button" onClick={() => setAttempt((previous) => previous + 1)}>Try again</button>
                </div>
              )}

              {stats && (
                <>
                  <div className="dashboard-columns">
                    <section className="panel panel-chart">
                      <div className="panel-head">
                        <div className="chart-head-label">
                          <h3>Order volume</h3>
                          <span className="panel-sub">{rangeLabel}</span>
                        </div>
                        <div className="chart-summary">
                          <span className="chart-summary-label">Total orders</span>
                          <span className="chart-summary-value">{stats.sales.reduce((sum, item) => sum + item.value, 0).toLocaleString("en-PH")}</span>
                        </div>
                      </div>
                      <div className="panel-body">
                        <div className="chart-wrap chart-wrap-volume">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={stats.sales} margin={{ top: 12, right: 24, left: 34, bottom: 28 }}>
                              <CartesianGrid vertical={false} stroke="#e5e9ef" />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#52617d" }} minTickGap={14} dy={8} />
                              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#52617d" }} width={34} domain={[0, 'auto']} />
                              <Tooltip content={<SalesTooltip />} cursor={{ stroke: "#c4cfe2" }} />
                              <Bar
                                dataKey="value"
                                fill="var(--color-primary)"
                                radius={[4, 4, 0, 0]}
                                isAnimationActive={false}
                                onClick={(e) => {
                                  const bar = e.target.closest(".recharts-rect");
                                  if (bar) {
                                    const index = Array.from(bar.parentNode.children).indexOf(bar);
                                    const item = stats.sales[index];
                                    if (item?.label) {
                                      const today = new Date();
                                      const start = new Date(today);
                                      start.setDate(start.getDate() - (RANGES.find(r => r.key === range)?.days ?? 7));
                                      const params = new URLSearchParams({ from: start.toISOString().split("T")[0], to: today.toISOString().split("T")[0] });
                                      navigate(`/orders?${params.toString()}`);
                                    }
                                  }
                                }}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        </div>
                    </section>

                    <section className="panel panel-chart">
                      <div className="panel-head">
                        <div className="chart-head-label">
                          <h3>Revenue trend</h3>
                          <span className="panel-sub">{rangeLabel}</span>
                        </div>
                        <div className="chart-summary">
                          <span className="chart-summary-label">Total revenue</span>
                          <span className="chart-summary-value">{pesoFormat(overview.revenue)}</span>
                        </div>
                      </div>
                      <div className="panel-body">
                        {!stats.revenueTrend || stats.revenueTrend.length === 0 ? (
                          <p className="panel-empty">No revenue data in this period.</p>
                        ) : (
                          <div className="chart-wrap chart-wrap-revenue">
                            <ResponsiveContainer width="100%" height={260}>
                              <AreaChart data={stats.revenueTrend} margin={{ top: 12, right: 24, left: 34, bottom: 28 }}>
                                <CartesianGrid vertical={false} stroke="#e5e9ef" />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#52617d" }} minTickGap={14} dy={8} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#52617d", formatter: (v) => pesoFormat(v) }} width={64} domain={[0, 'auto']} />
                                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#c4cfe2" }} />
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  fill="var(--color-primary)"
                                  stroke="var(--color-primary)"
                                  opacity={[0.1, 0]}
                                  isAnimationActive={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  stroke="#94a3b8"
                                  strokeDasharray="5 5"
                                  strokeWidth={2}
                                  dot={false}
                                  isAnimationActive={false}
                                  data={stats.revenueTrend.map(d => ({ ...d, value: d.value * 0.85 }))}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </section>

                  </div>

                  <div className="section-divider" />

                  <div className="dashboard-secondary">
                    <RecentActivity key={activeBusinessId} entries={overview.recentActivity} />
                    <section className="panel panel-inventory">
                      <div className="panel-head">
                        <h2>Inventory alert</h2>
                        <Link to="/inventory" className="panel-link">View inventory</Link>
                      </div>
                      <div className="panel-body">
                        {/* Grouped inventory statistics with subtle background */}
                        <div className="inventory-stats">
                          <div className="inventory-stat">
                            <dt>Products listed</dt>
                            <dd>{overview.products.toLocaleString("en-PH")}</dd>
                          </div>
                          <div className="inventory-stat">
                            <dt>Below 10 in stock</dt>
                            <dd className={overview.lowStock > 0 ? "inventory-stat-warning" : "inventory-stat-ok"}>
                              {overview.lowStock.toLocaleString("en-PH")}
                            </dd>
                          </div>
                        </div>
                        {lowStockLoading ? (
                          <p className="panel-empty">Loading low-stock products…</p>
                        ) : overview.lowStock === 0 ? (
                          <p className="panel-empty">All products are well stocked.</p>
                        ) : (
                          <>
                            {/* Low-stock warning header */}
                            <div className="inventory-warning">
                              <span className="inventory-warning-icon" aria-hidden="true">⚠</span>
                              <span className="inventory-warning-text">
                                {overview.lowStock} product{overview.lowStock === 1 ? "" : "s"} need restocking
                              </span>
                            </div>

                            {/* Low-stock product list */}
                            <ul className="low-stock-list" aria-label="Low stock products">
                              {lowStockProducts.map((product) => (
                                <li key={product.product_id} className="low-stock-item">
                                  <div className="low-stock-product">
                                    <span className="low-stock-name">{product.product_name}</span>
                                    {product.sku && <span className="low-stock-sku">{product.sku}</span>}
                                  </div>
                                  <span className={`low-stock-qty ${product.stock_quantity === 0 ? "low-stock-qty-out" : "low-stock-qty-low"}`}>{product.stock_quantity}</span>
                                  <button
                                    type="button"
                                    className="restock-btn"
                                    onClick={() => navigate(`/inventory?restock=${product.product_id}`)}
                                    aria-label={`Restock ${product.product_name}`}
                                  >
                                    Restock
                                  </button>
                                </li>
                              ))}
                            </ul>

                            {/* Restock action at bottom */}
                            <div className="inventory-cta">
                              <Link to="/inventory" className="cta-link cta-link-primary">Restock now &rarr;</Link>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                    <section className="panel panel-category">
                      <div className="panel-head">
                        <h2>Sales by category</h2>
                      </div>
                      <div className="panel-body">
                        {!stats.categoryRevenue || stats.categoryRevenue.length === 0 ? (
                          <p className="panel-empty">No category sales data in this period.</p>
                        ) : (
                          <CategoryDonut data={stats.categoryRevenue} />
                        )}
                      </div>
                    </section>
                    <section className="panel panel-top-customers">
                      <div className="panel-head">
                        <h2>Top customers by revenue</h2>
                      </div>
                      <div className="panel-body">
                        {!stats.topCustomers ||
                          stats.topCustomers.length === 0 ||
                          stats.topCustomers.every((c) => !c.value) ? (
                          <p className="panel-empty">No customer revenue data in this period.</p>
                        ) : (
                          <TopCustomers data={stats.topCustomers} />
                        )}
                      </div>
                    </section>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
