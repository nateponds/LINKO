import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AppLayout from "../layouts/AppLayout";
import TrackingTimeline from "../features/logistics/TrackingTimeline";
import { apiGet, apiSend } from "../lib/api";
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
  return Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
    : 0;
}

export default function OrdersPage() {
  const { memberships, activeMembership, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Ship-order modal (wholesaler enters weight at handoff).
  const [shipOrder, setShipOrder] = useState(null);
  const [shipWeight, setShipWeight] = useState("");
  const [shipDimensions, setShipDimensions] = useState("");
  const [shipError, setShipError] = useState(null);

  // Buyer parcel-tracking modal.
  const [trackParcel, setTrackParcel] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGet("/api/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiGet("/api/orders");
        if (active) {
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const visibleOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const selectedStatus = statusFilter.toLowerCase();

    return orders.filter((order) => {
      const orderStatus = statusLabel(order.status);
      if (
        statusFilter !== "All" &&
        orderStatus.toLowerCase() !== selectedStatus
      ) {
        return false;
      }

      return (
        !term ||
        String(order.order_id ?? "")
          .toLowerCase()
          .includes(term) ||
        (order.buyer_business_name ?? "").toLowerCase().includes(term) ||
        (order.wholesaler_business_name ?? "").toLowerCase().includes(term) ||
        (order.invoice?.invoice_number ?? "").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, statusFilter]);

  async function updateOrderStatus(orderId, nextStatus, extra = {}) {
    setUpdatingId(orderId);
    setError(null);

    try {
      const updatedOrder = await apiSend(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: { status: nextStatus, ...extra },
      });

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId ? { ...order, ...updatedOrder } : order,
        ),
      );
      void loadOrders();
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setUpdatingId(null);
    }
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
    // Honor the selected business when it matches an order side; otherwise fall
    // back to scanning all memberships (covers single-business users and cases
    // where the active business is unrelated to this order).
    const matchesActive = (role, businessId) =>
      activeMembership?.role === role &&
      activeMembership?.business_id === businessId;
    const ownsBuyerSide =
      matchesActive("buyer", order.buyer_business_id) ||
      memberships.some(
        (membership) =>
          membership.role === "buyer" &&
          membership.business_id === order.buyer_business_id,
      );
    const ownsWholesalerSide =
      matchesActive("wholesaler", order.wholesaler_business_id) ||
      memberships.some(
        (membership) =>
          membership.role === "wholesaler" &&
          membership.business_id === order.wholesaler_business_id,
      );

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
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
            <div className="page-empty">Loading orders...</div>
          ) : error ? (
            <div className="page-empty">
              Could not load orders: {error}
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="page-empty">No orders match your search.</div>
          ) : (
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
                {visibleOrders.map((order) => {
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
                                  (() =>
                                    updateOrderStatus(
                                      order.order_id,
                                      action.nextStatus,
                                    ))
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
          )}
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
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
