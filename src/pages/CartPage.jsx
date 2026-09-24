import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";
import { peso } from "../lib/format";
import { useCart } from "../features/cart/CartProvider";
import { addressBookCopy, formatAddress } from "../features/settings/addressCopy";
import {
  bundleDeliveryFee,
  bundleSubtotal,
  checkoutBlocker,
  isLocationPinError,
  orderItemsForGroup,
  supplierGroups,
  tierBaseFee,
} from "../features/cart/cart";
import "./CartPage.css";

export default function CartPage() {
  const { cart, updateQuantity, removeProduct, removeProducts } = useCart();
  const { activeBusiness, activeBusinessId, refreshAuth } = useAuth();
  const addressCopy = addressBookCopy(activeBusiness);
  const canPickAddress = Boolean(
    activeBusiness?.roles?.includes("buyer") || activeBusiness?.roles?.includes("wholesaler"),
  );
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [tiersError, setTiersError] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [pinError, setPinError] = useState(null);
  const [successes, setSuccesses] = useState([]);
  const [failures, setFailures] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [addressBook, setAddressBook] = useState(null);
  const addressBookReady = canPickAddress && addressBook?.businessId === activeBusinessId;
  const savedAddresses = addressBookReady ? addressBook.addresses : [];
  const selectedAddressId = addressBookReady ? addressBook.selectedId : null;
  const addressesLoading = canPickAddress && !addressBookReady;

  useEffect(() => {
    let cancelled = false;
    async function loadTiers() {
      try {
        const tiersList = await apiGet("/api/service-tiers");
        if (cancelled) return;
        const next = Array.isArray(tiersList) ? tiersList : [];
        setTiers(next);
        setSelectedTierId(next[0]?.tier_id ?? null);
      } catch (err) {
        if (!cancelled) setTiersError(err.message);
      }
    }
    loadTiers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickAddress) return undefined;
    let cancelled = false;
    const businessId = activeBusinessId;
    apiGet("/api/settings/addresses")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.addresses) ? data.addresses : [];
        const preferred = list.find((row) => row.is_default) ?? list[0];
        setAddressBook({
          businessId,
          addresses: list,
          selectedId: preferred?.address_id ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setAddressBook({ businessId, addresses: [], selectedId: null });
      });
    return () => { cancelled = true; };
  }, [activeBusinessId, canPickAddress]);

  const groups = useMemo(() => supplierGroups(cart), [cart]);
  const subtotal = useMemo(() => bundleSubtotal(cart), [cart]);
  const selectedTier = tiers.find((tier) => tier.tier_id === selectedTierId) ?? null;
  const deliveryFee = bundleDeliveryFee(selectedTier, groups.length);
  const total = subtotal + deliveryFee;
  const itemCount = groups.reduce(
    (sum, group) => sum + group.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0,
  );

  function checkoutCart() {
    if (groups.length === 0 || checkingOut) return;
    setCheckoutError(null);
    setPinError(null);

    const blocked = checkoutBlocker(cart);
    if (blocked) {
      setCheckoutError(blocked);
      return;
    }
    if (!selectedTierId) {
      setCheckoutError("Please select a delivery tier.");
      return;
    }

    const selectedAddress = savedAddresses.find((row) => row.address_id === selectedAddressId);
    if (canPickAddress && savedAddresses.length === 0 && !addressesLoading) {
      setCheckoutError(`Add a ${addressCopy.noun} in Settings before placing the order.`);
      return;
    }
    if (canPickAddress && savedAddresses.length > 0 && !selectedAddress) {
      setCheckoutError(`Choose a ${addressCopy.noun} before placing the order.`);
      return;
    }

    const supplierLabel = groups.length === 1 ? "1 supplier" : `${groups.length} suppliers`;
    const addressLine = selectedAddress
      ? ` ${addressCopy.checkoutLabel}: ${selectedAddress.label} (${formatAddress(selectedAddress)}).`
      : "";
    setConfirm({
      title: "Place cash on delivery orders?",
      message: `Place cash on delivery orders with ${supplierLabel} for ${itemCount} item${itemCount === 1 ? "" : "s"} totalling ${peso(total)} (including ${peso(deliveryFee)} delivery).${addressLine}`,
      confirmLabel: "Place orders",
      onConfirm: () => { void submitCheckout(); },
    });
  }

  async function submitCheckout() {
    setCheckingOut(true);
    setCheckoutError(null);
    setPinError(null);
    setSuccesses([]);
    setFailures([]);

    const placedIds = [];
    const placedOrders = [];
    const failedOrders = [];
    let stopForPin = false;

    try {
      const selectedAddress = savedAddresses.find((row) => row.address_id === selectedAddressId);
      if (selectedAddress && !selectedAddress.is_default) {
        await apiSend(`/api/settings/addresses/${selectedAddress.address_id}/default`, { method: "POST" });
        await refreshAuth();
        setAddressBook((current) => (current ? {
          ...current,
          addresses: current.addresses.map((row) => ({
            ...row,
            is_default: row.address_id === selectedAddress.address_id,
          })),
        } : current));
      }
    } catch (err) {
      setCheckoutError(err.message);
      setCheckingOut(false);
      return;
    }

    for (const group of groups) {
      if (stopForPin) break;
      try {
        const order = await apiSend("/api/orders", {
          body: {
            tier_id: selectedTierId,
            items: orderItemsForGroup(group),
          },
        });
        placedOrders.push({
          businessName: group.businessName,
          orderId: order?.order_id,
          status: order?.status,
          total: order?.total,
        });
        for (const line of group.lines) placedIds.push(line.product.product_id);
      } catch (err) {
        failedOrders.push({
          businessName: group.businessName,
          message: err.message,
          status: err.status,
        });
        if (isLocationPinError(err)) {
          setPinError(err.message);
          stopForPin = true;
        }
      }
    }

    if (placedIds.length > 0) removeProducts(placedIds);
    setSuccesses(placedOrders);
    setFailures(failedOrders);
    setCheckingOut(false);
  }

  return (
    <AppLayout>
      <div className="cart-page">
        <header className="cart-page-header">
          <div>
            <h1>Cart</h1>
            <p>
              {groups.length === 0
                ? "Your cart is empty."
                : `${itemCount} item${itemCount === 1 ? "" : "s"} from ${groups.length} supplier${groups.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <ShoppingCart size={22} />
        </header>

        <p className="cart-cod">Every order is cash on delivery.</p>

        {groups.length === 0 ? (
          <p className="cart-empty">
            Add products from a supplier shop or the marketplace.{" "}
            <Link to="/">Browse wholesalers</Link>
          </p>
        ) : (
          <div className="cart-groups">
            {groups.map((group) => (
              <section className="cart-group" key={group.businessId} aria-label={group.businessName}>
                <h2>
                  <Link to={`/suppliers/${group.businessId}`}>{group.businessName}</Link>
                </h2>
                <div className="cart-lines">
                  {group.lines.map((line) => {
                    const maxQuantity = Math.max(Number(line.product.stock_quantity) || 0, 1);
                    return (
                      <div className="cart-line" key={line.productId}>
                        <div className="cart-line-main">
                          <div className="cart-line-name">{line.product.product_name}</div>
                          <div className="cart-line-price">{peso(line.lineTotal)}</div>
                        </div>
                        <div className="cart-line-actions">
                          <div className="cart-stepper">
                            <button
                              type="button"
                              aria-label={`Decrease ${line.product.product_name}`}
                              onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={maxQuantity}
                              value={line.quantity}
                              onChange={(event) => updateQuantity(line.productId, event.target.value)}
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${line.product.product_name}`}
                              disabled={line.quantity >= Number(line.product.stock_quantity)}
                              onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="remove-cart-btn"
                            aria-label={`Remove ${line.product.product_name}`}
                            onClick={() => removeProduct(line.productId)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-total-row">
                  <span>Supplier subtotal</span>
                  <strong>{peso(group.lines.reduce((sum, line) => sum + line.lineTotal, 0))}</strong>
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="cart-checkout" aria-label="Checkout">
          {groups.length > 0 && canPickAddress && (
            <div className="cart-address-selection">
              <label htmlFor="checkout-address">{addressCopy.checkoutLabel}</label>
              {addressesLoading ? (
                <p className="cart-cod-note">Loading saved addresses…</p>
              ) : savedAddresses.length === 0 ? (
                <p className="cart-cod-note">
                  No saved addresses yet.{" "}
                  <Link to="/settings/business-location">Add one in Settings</Link>
                </p>
              ) : (
                <select
                  id="checkout-address"
                  value={selectedAddressId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    setAddressBook((current) => (current ? { ...current, selectedId: nextId } : current));
                    setCheckoutError(null);
                  }}
                >
                  {savedAddresses.map((address) => (
                    <option key={address.address_id} value={address.address_id}>
                      {address.label}
                      {address.is_default ? " (default)" : ""}
                      {" — "}
                      {formatAddress(address)}
                      {address.has_coordinates ? "" : " (not pinned)"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {groups.length > 0 && tiers.length > 0 && (
            <label className="cart-tier-selection">
              Delivery speed
              <select
                value={selectedTierId ?? ""}
                onChange={(event) => setSelectedTierId(Number(event.target.value))}
              >
                {tiers.map((tier) => (
                  <option key={tier.tier_id} value={tier.tier_id}>
                    {tier.tier_name} ({tier.estimated_days} days) — {peso(tierBaseFee(tier))} per order
                  </option>
                ))}
              </select>
            </label>
          )}

          {groups.length > 0 && (
            <>
              <div className="cart-total-row">
                <span>Subtotal</span>
                <strong>{peso(subtotal)}</strong>
              </div>
              <div className="cart-total-row">
                <span>Delivery ({groups.length} order{groups.length === 1 ? "" : "s"})</span>
                <strong>{peso(deliveryFee)}</strong>
              </div>
              <div className="cart-total-row cart-grand-total">
                <span>Total</span>
                <strong>{peso(total)}</strong>
              </div>
              <p className="cart-cod-note">Payment method: cash on delivery. One order is placed per supplier.</p>
            </>
          )}

          {tiersError && <p className="cart-error">Could not load delivery tiers: {tiersError}</p>}
          {checkoutError && <p className="cart-error">{checkoutError}</p>}
          {pinError && (
            <p className="cart-error">
              {pinError}{" "}
              <Link to="/settings/business-location">Go to Settings</Link>
            </p>
          )}

          {failures.filter((failure) => !isLocationPinError(failure)).length > 0 && (
            <div className="cart-error" role="alert">
              {failures.filter((failure) => !isLocationPinError(failure)).map((failure) => (
                <p key={failure.businessName}>
                  {failure.businessName}: {failure.message}
                </p>
              ))}
            </div>
          )}

          {successes.length > 0 && (
            <div className="checkout-confirmation">
              <div className="confirmation-title">Cash on delivery orders placed</div>
              {successes.map((order) => (
                <div key={order.orderId ?? order.businessName}>
                  {order.businessName}: order #{order.orderId}
                  {order.status ? ` · ${order.status}` : ""}
                  {order.total != null ? ` · ${peso(order.total)}` : ""}
                </div>
              ))}
              <Link to="/orders">View orders</Link>
            </div>
          )}

          <button
            type="button"
            className="checkout-btn"
            disabled={groups.length === 0 || checkingOut || addressesLoading}
            onClick={checkoutCart}
          >
            {checkingOut ? "Placing orders..." : "Checkout cash on delivery"}
          </button>
        </section>

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
