import { useCallback, useEffect, useState, useRef } from "react";
import { Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AppLayout from "../layouts/AppLayout";
import TrackingTimeline from "../features/logistics/TrackingTimeline";
import SupportModal from "../components/ui/SupportModal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { apiGet, apiSend } from "../lib/api";
import PaginationControls from "../components/ui/PaginationControls";
import { useListUrlState } from "../hooks/useListUrlState";
import { peso, shortDate, statusClass } from "../lib/format";
import "./OrdersPage.css";

// Buyers can watch a parcel from these order states; earlier states have no
// parcel yet, and there is nothing to track once it is fully wound down.
const TRACKABLE_STATUSES = new Set(["shipped", "delivered", "returned"]);

const STATUS_TABS = [
  "All",
  "Pending",
  "Accepted",
  "Preparing",
  "Shipped",
  "Delivered",
  "Returned",
  "Cancelled",
];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

function normalizeStatus(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? (status || "Unknown");
}

function itemCount(order) {
  return Number.isFinite(Number(order.item_count))
    ? Number(order.item_count)
    : Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
    : 0;
}

function useOrderPage(path) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState({ data: null, error: null, key: null });
  const key = `${path}:${reloadVersion}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    apiGet(path, { signal: controller.signal })
      .then((data) => active && setState({ data, error: null, key }))
      .catch((error) => {
        if (active && error?.name !== "AbortError") {
          setState((previous) => ({ data: previous.data, error, key }));
        }
      });
    return () => { active = false; controller.abort(); };
  }, [key, path]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    staleData: state.data,
    error: current ? state.error : null,
    loading: !current,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}

export default function OrdersPage() {
  const { activeBusinessId, activeRoles, user } = useAuth();
  const location = useLocation();
  const list = useListUrlState();
  const statusFilter = new URLSearchParams(location.search).get("status") || "All";
  const query = new URLSearchParams({ page: String(list.page), limit: String(list.limit) });
  if (list.q) query.set("q", list.q);
  if (statusFilter !== "All") query.set("status", statusFilter.toLowerCase());
  const resource = useOrderPage(`/api/orders?${query.toString()}`);
  const searchTimerRef = useRef(null);
  const pageData = resource.data ?? resource.staleData;
  const orders = pageData?.items ?? null;
  const pagination = pageData?.pagination ?? null;
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const tabsContainerRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ opacity: 0 });

  const tableContentRef = useRef(null);
  const [tableHeight, setTableHeight] = useState("auto");

  useEffect(() => {
    if (!tableContentRef.current || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver((entries) => {
      setTableHeight(entries[0].target.offsetHeight);
    });
    observer.observe(tableContentRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    const totalPages = resource.data?.pagination?.total_pages ?? 0;
    if (totalPages > 0 && list.page > totalPages) {
      list.update({ page: totalPages }, { replace: true });
    }
  }, [list, resource.data]);

  function queueSearch(nextQuery) {
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => list.setQuery(nextQuery), 300);
  }

  useEffect(() => {
    function updatePill() {
      if (!tabsContainerRef.current) return;
      const activeBtn = tabsContainerRef.current.querySelector('button[aria-selected="true"]');
      if (activeBtn) {
        setPillStyle({
          left: activeBtn.offsetLeft,
          top: activeBtn.offsetTop,
          width: activeBtn.offsetWidth,
          height: activeBtn.offsetHeight,
          opacity: 1,
        });
      }
    }
    const timer = setTimeout(updatePill, 0);
    window.addEventListener("resize", updatePill);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePill);
    };
  }, [statusFilter, orders?.length]);

  // Ship-order modal (wholesaler enters weight at handoff).
  const [shipOrder, setShipOrder] = useState(null);
  const [shipWeight, setShipWeight] = useState("");
  const [shipDimensions, setShipDimensions] = useState("");
  const [shipError, setShipError] = useState(null);

  // Buyer parcel-tracking modal.
  const [trackParcel, setTrackParcel] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function updateOrderStatus(orderId, nextStatus, extra = {}) {
    setUpdatingId(orderId);
    setActionError(null);

    try {
      await apiSend(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: { status: nextStatus, ...extra },
      });
      resource.reload();
    } catch (caughtError) {
      setActionError(caughtError.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Cancelling/rejecting an order is terminal, so it goes through a confirm
  // dialog. Accept and advance-to-preparing stay one-click.
  function requestStatusChange(order, action) {
    if (action.nextStatus !== "cancelled") {
      void updateOrderStatus(order.order_id, action.nextStatus);
      return;
    }
    const isReject = action.label === "Reject";
    setConfirm({
      title: isReject ? "Reject order?" : "Cancel order?",
      message: isReject
        ? `Reject order #${order.order_id} from ${order.buyer_business_name ?? "this buyer"} for ${peso(order.total)}? This cannot be undone.`
        : `Cancel order #${order.order_id} with ${order.wholesaler_business_name ?? "this seller"} for ${peso(order.total)}? This cannot be undone.`,
      confirmLabel: isReject ? "Reject order" : "Cancel order",
      onConfirm: () => { void updateOrderStatus(order.order_id, action.nextStatus); },
    });
  }

  async function confirmShip() {
    const weight = Number(shipWeight);
    if (!(weight > 0)) {
      setShipError("Enter a weight in kilograms greater than 0.");
      return;
    }
    const orderId = shipOrder.order_id;
    setShipError(null);
    setShipOrder(null);
    setShipWeight("");
    setShipDimensions("");
    await updateOrderStatus(orderId, "shipped", {
      weight_kg: weight,
      ...(shipDimensions.trim() ? { dimensions: shipDimensions.trim() } : {}),
    });
  }

  async function openTracking(order) {
    setTrackParcel({ order_id: order.order_id, parcel: null });
    setTrackLoading(true);
    setTrackError(null);
    try {
      const parcel = await apiGet(`/api/parcels/${order.parcel_id}`);
      setTrackParcel({ order_id: order.order_id, parcel });
    } catch (caughtError) {
      setTrackError(caughtError.message);
    } finally {
      setTrackLoading(false);
    }
  }

  function actionsFor(order) {
    const status = normalizeStatus(order.status);
    const actions = [];

    // Buyer parcel tracking is available to whoever can see the order (buyer,
    // wholesaler, admin) once a parcel exists — a read-only modal, no logistics
    // workspace access. Operators still have the full parcel detail page.
    if (order.parcel_id && TRACKABLE_STATUSES.has(status)) {
      actions.push({ label: "Track parcel", onClick: () => openTracking(order) });
    }

    if (user?.global_role === "platform_admin") {
      return actions;
    }
    // Actions are scoped to the ACTIVE business only: the caller must be acting
    // as the order's buyer/wholesaler side through their selected business.
    // Capabilities from any unselected business grant nothing here.
    const ownsBuyerSide =
      activeBusinessId === order.buyer_business_id && activeRoles.includes("buyer");
    const ownsWholesalerSide =
      activeBusinessId === order.wholesaler_business_id &&
      activeRoles.includes("wholesaler");

    if (status === "pending") {
      if (ownsWholesalerSide) {
        actions.push({ label: "Accept", nextStatus: "accepted" });
        actions.push({ label: "Reject", nextStatus: "cancelled" });
      } else if (ownsBuyerSide) {
        actions.push({ label: "Cancel", nextStatus: "cancelled" });
      }
      return actions;
    }

    if (!ownsWholesalerSide) {
      return actions;
    }

    if (status === "accepted") {
      actions.push({ label: "Preparing", nextStatus: "preparing" });
    } else if (status === "preparing") {
      // Ship collects the real weight at handoff — open the modal, don't PATCH.
      actions.push({ label: "Ship", onClick: () => setShipOrder(order) });
    }
    // Past "shipped" the courier owns the parcel; delivery is confirmed by
    // their tracking scan, not the wholesaler.

    return actions;
  }

  return (
    <AppLayout>
      <div className="orders-page">
        <div className="page-head">
          <h1>Orders</h1>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search order no., customer, seller, invoice"
              key={list.q}
              defaultValue={list.q}
              onChange={(event) => queueSearch(event.target.value)}
            />
            <button className="search-icon-btn" aria-label="Search">
              <Search size={16} />
            </button>
          </div>
        </div>

        <div
          className="status-tabs"
          role="tablist"
          aria-label="Filter by status"
          ref={tabsContainerRef}
        >
          <div className="sliding-pill" style={pillStyle} />
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={statusFilter === tab}
              className={statusFilter === tab ? "active" : ""}
              onClick={() => list.setFilters({ status: tab === "All" ? "" : tab.toLowerCase() })}
            >
              {tab}
            </button>
          ))}
        </div>

        <main className="table-card" aria-busy={resource.loading}>
          {actionError && <div className="page-empty page-empty--inline">Could not update order: {actionError}</div>}
          <div
            className="table-height-animator"
            style={{
              height: tableHeight === "auto" ? "auto" : `${tableHeight}px`,
              overflow: "hidden",
              transition: "height 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            <div ref={tableContentRef}>
              {orders === null && resource.loading ? (
                <div className="page-empty">Loading orders...</div>
              ) : resource.error && !orders?.length ? (
                <div className="page-empty">
                  Could not load orders: {resource.error.message}
                </div>
              ) : (orders?.length ?? 0) === 0 ? (
                <div className="page-empty">
                  {list.q || statusFilter !== "All" ? "No orders match these filters." : "No orders are visible for this account yet."}
                  {(list.q || statusFilter !== "All") && (
                    <button
                      className="clear-list-filters"
                      type="button"
                      onClick={() => list.update({ q: "", filters: { status: "" } })}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {resource.error && <div className="page-empty page-empty--inline">Could not refresh orders: {resource.error.message}</div>}
                  <div className="orders-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order No.</th>
                          <th>Customer</th>
                          <th>Seller</th>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Invoice</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => {
                        const orderActions = actionsFor(order);
                        const disabled = updatingId === order.order_id;

                        return (
                          <tr key={order.order_id}>
                            <td>#{order.order_id}</td>
                            <td>
                              <strong>{order.buyer_business_name ?? "—"}</strong>
                            </td>
                            <td>{order.wholesaler_business_name ?? "—"}</td>
                            <td>{shortDate(order.created_at)}</td>
                            <td>{itemCount(order)}</td>
                            <td>{peso(order.total)}</td>
                            <td>
                              <span
                                className={`status ${statusClass(statusLabel(order.status))}`}
                              >
                                {statusLabel(order.status)}
                              </span>
                            </td>
                            <td>
                              {order.invoice?.invoice_id ? (
                                <Link
                                  className="track-link"
                                  to={`/invoices?invoice=${order.invoice.invoice_id}`}
                                >
                                  {order.invoice.invoice_number ?? "Invoice"}
                                </Link>
                              ) : (
                                <span className="muted-cell">—</span>
                              )}
                            </td>
                            <td>
                              {orderActions.length > 0 ? (
                                <div
                                  className="order-actions"
                                  aria-label={`Actions for order ${order.order_id}`}
                                >
                                  {orderActions.map((action) => (
                                    <button
                                      key={`${action.label}-${action.nextStatus ?? "fn"}`}
                                      className="track-link action-button"
                                      type="button"
                                      disabled={disabled && !action.onClick}
                                      onClick={
                                        action.onClick ??
                                        (() => requestStatusChange(order, action))
                                      }
                                    >
                                      {disabled && !action.onClick
                                        ? "Updating"
                                        : action.label}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted-cell">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    pagination={pagination}
                    disabled={resource.loading}
                    onPageChange={list.setPage}
                    onLimitChange={list.setLimit}
                    ariaLabel="Orders pagination"
                  />
                </>
              )}
            </div>
          </div>
        </main>

        {/* Ship order: wholesaler records the parcel weight at handoff. */}
        <div className={`modal-overlay${shipOrder ? " open" : ""}`}>
          {shipOrder && (
            <div className="modal-box">
              <button
                className="modal-close"
                type="button"
                onClick={() => {
                  setShipOrder(null);
                  setShipError(null);
                }}
              >
                ×
              </button>
              <h2>Ship order #{shipOrder.order_id}</h2>
              {shipError && <p className="form-error">{shipError}</p>}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmShip();
                }}
              >
                <label>
                  Weight (kg) *
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={shipWeight}
                    onChange={(event) => setShipWeight(event.target.value)}
                    placeholder="e.g. 7.5"
                    autoFocus
                    required
                  />
                </label>
                <label>
                  Dimensions (optional)
                  <input
                    type="text"
                    value={shipDimensions}
                    onChange={(event) => setShipDimensions(event.target.value)}
                    placeholder="e.g. 40x30x20 cm"
                  />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShipOrder(null);
                      setShipError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Ship order
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Buyer parcel tracking: read-only timeline, no logistics workspace. */}
        <div className={`modal-overlay${trackParcel ? " open" : ""}`}>
          {trackParcel && (
            <div className="modal-box">
              <button
                className="modal-close"
                type="button"
                onClick={() => setTrackParcel(null)}
              >
                ×
              </button>
              <h2>Track order #{trackParcel.order_id}</h2>
              {trackLoading ? (
                <p className="form-note">Loading tracking…</p>
              ) : trackError ? (
                <p className="form-error">Could not load tracking: {trackError}</p>
              ) : trackParcel.parcel ? (
                <>
                  <p className="track-parcel-meta">
                    Parcel #{trackParcel.parcel.parcel_id} ·{" "}
                    <span
                      className={`status ${statusClass(
                        trackParcel.parcel.current_status,
                      )}`}
                    >
                      {trackParcel.parcel.current_status ?? "—"}
                    </span>
                  </p>
                  <TrackingTimeline parcel={trackParcel.parcel} />
                </>
              ) : (
                <p className="form-note">No tracking available.</p>
              )}
              <button
                type="button"
                className="support-link-btn"
                onClick={() => setSupportOpen(true)}
              >
                Need help? Contact customer service
              </button>
            </div>
          )}
        </div>

        <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AppLayout>
  );
}
