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
import { TableSkeleton, TrackingSkeleton } from "../components/ui/pageSkeletons";
import ExpandableTableRow from "../components/ui/ExpandableTableRow";
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
  const { activeBusinessId } = useAuth();
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

  function submitSearch(event) {
    event.preventDefault();
    window.clearTimeout(searchTimerRef.current);
    const nextQuery = new FormData(event.currentTarget).get("q");
    list.setQuery(String(nextQuery ?? ""));
  }

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

    // Buyer parcel tracking is available to whoever can see the order (buyer
    // or wholesaler) once a parcel exists - a read-only modal, no logistics
    // workspace access. Operators still have the full parcel detail page.
    if (order.parcel_id && TRACKABLE_STATUSES.has(status)) {
      actions.push({ label: "Track parcel", onClick: () => openTracking(order) });
    }

    // Your side of an order is decided by the order, not by your role: the
    // active business is the buyer side if it placed the order (a wholesaler
    // buying stock included) and the seller side if it is the wholesaler.
    const ownsBuyerSide = activeBusinessId === order.buyer_business_id;
    const ownsWholesalerSide = activeBusinessId === order.wholesaler_business_id;

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
      // Ship collects the real weight at handoff - open the modal, don't PATCH.
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
          <form className="search-bar" role="search" aria-label="Search orders" onSubmit={submitSearch}>
            <input
              name="q"
              type="text"
              aria-label="Search orders"
              placeholder="Search order no., customer, seller, invoice"
              key={list.q}
              defaultValue={list.q}
              onChange={(event) => queueSearch(event.target.value)}
            />
            <button type="submit" className="search-icon-btn" aria-label="Search orders">
              <Search size={16} />
            </button>
          </form>
        </div>

        <div
          className="status-tabs"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={normalizeStatus(statusFilter) === normalizeStatus(tab)}
              onClick={() => list.setFilters({ status: tab === "All" ? "" : tab.toLowerCase() })}
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="table-card" aria-label="Order results" aria-busy={resource.loading}>
          {actionError && <div className="page-empty page-empty--inline" role="alert">Could not update order: {actionError}</div>}
          <div>
              {orders === null && resource.loading ? (
                <TableSkeleton columns={5} rows={8} label="Loading orders" />
              ) : resource.error && !orders?.length ? (
                <div className="page-empty" role="alert">
                  <strong>Could not load orders.</strong>
                  <button type="button" className="clear-list-filters" onClick={resource.reload}>Try again</button>
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
                  {resource.error && (
                    <div className="page-empty page-empty--inline" role="alert">
                      Could not refresh orders. Showing previous results.
                      <button type="button" className="clear-list-filters" onClick={resource.reload}>Try again</button>
                    </div>
                  )}
                  <div className="orders-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Order</th>
                          <th scope="col">Business</th>
                          <th scope="col" className="table-status">Status</th>
                          <th scope="col" className="order-number-cell">Total</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => {
                        const orderActions = actionsFor(order);
                        const disabled = updatingId === order.order_id;
                        const buying = activeBusinessId === order.buyer_business_id;
                        const partner = buying ? order.wholesaler_business_name : order.buyer_business_name;
                        const otherBusiness = buying ? order.buyer_business_name : order.wholesaler_business_name;

                        return (
                          <ExpandableTableRow
                            key={order.order_id}
                            label={`Order #${order.order_id}`}
                            cells={[
                              { key: "order", className: "order-identity", content: <>#{order.order_id}<small>{shortDate(order.created_at)}</small></> },
                              { key: "partner", content: partner ?? "-" },
                              { key: "status", content: <span className={`status ${statusClass(statusLabel(order.status))}`}>{statusLabel(order.status)}</span> },
                              { key: "total", className: "order-number-cell", content: peso(order.total) },
                              {
                                key: "actions",
                                content: orderActions.length > 0 ? (
                                  <div className="order-actions" aria-label={`Actions for order ${order.order_id}`}>
                                    {orderActions.map((action) => (
                                      <button
                                        key={`${action.label}-${action.nextStatus ?? "fn"}`}
                                        className="track-link action-button"
                                        type="button"
                                        disabled={disabled && !action.onClick}
                                        onClick={action.onClick ?? (() => requestStatusChange(order, action))}
                                      >
                                        {disabled && !action.onClick ? "Updating" : action.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : <span className="muted-cell">-</span>,
                              },
                            ]}
                          >
                            <dl>
                              <div><dt>{buying ? "Customer" : "Seller"}</dt><dd>{otherBusiness ?? "-"}</dd></div>
                              <div><dt>Items</dt><dd>{itemCount(order)}</dd></div>
                              <div>
                                <dt>Invoice</dt>
                                <dd>{order.invoice?.invoice_id ? (
                                  <Link className="track-link" to={`/invoices?invoice=${order.invoice.invoice_id}`}>
                                    {order.invoice.invoice_number ?? "View invoice"}
                                  </Link>
                                ) : "-"}</dd>
                              </div>
                            </dl>
                          </ExpandableTableRow>
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
        </section>

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
                <TrackingSkeleton />
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
                      {trackParcel.parcel.current_status ?? "-"}
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
