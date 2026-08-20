// Buyer-facing product detail modal, opened from the supplier profile grid or
// deep-linked from the marketplace via ?product_id=. Surfaces products.description,
// which until now was only ever visible to the owning wholesaler in Inventory.
// Callers own `open` and all cart logic; this component only renders and reports
// intent, mirroring the prop-driven contract of ConfirmDialog.
// ponytail: no exit animation — ConfirmDialog carries `closing`/EXIT_MS only to
// sync with a CSS slide-out. A plain fade needs no unmount delay.
import { useEffect, useRef } from "react";
import { ShoppingCart, X } from "lucide-react";
import { peso, stockBadge } from "../../lib/format";

const TITLE_ID = "product-detail-title";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400";

export default function ProductDetailModal({
  open,
  product,
  loading = false,
  error = null,
  quantity = 1,
  maxQuantity = 0,
  onQuantityChange,
  onAddToCart,
  onClose,
}) {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      document.body.style.overflow = "hidden";
      dialogRef.current?.focus();
      return;
    }
    document.body.style.overflow = "";
    // Only restore focus if this close follows an open — otherwise the effect's
    // initial run would yank focus on every mount.
    if (previousFocus.current) {
      previousFocus.current.focus();
      previousFocus.current = null;
    }
  }, [open]);

  // Restore scrolling if we unmount while still open (e.g. route change).
  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const badge = product ? stockBadge(product.stock_status) : null;
  const isAvailable =
    !!product && product.stock_status !== "out_of_stock" && maxQuantity > 0;

  return (
    <div
      className="product-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="product-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex="-1"
        ref={dialogRef}
      >
        <button
          type="button"
          className="product-modal-close"
          aria-label="Close product details"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        {loading && <p className="product-modal-status">Loading product…</p>}
        {!loading && error && (
          <p className="product-modal-status" role="alert">{error}</p>
        )}
        {!loading && !error && !product && (
          <p className="product-modal-status" role="alert">
            That product is not available from this supplier.
          </p>
        )}

        {!loading && !error && product && (
          <div className="product-modal-body">
            <div className="product-modal-image">
              <img
                src={product.image_url ?? FALLBACK_IMAGE}
                alt={product.product_name}
              />
            </div>
            <div className="product-modal-details">
              <h2 id={TITLE_ID} className="product-modal-name">
                {product.product_name}
              </h2>
              <div className="product-modal-price">{peso(product.unit_price)}</div>
              <div className="product-modal-badges">
                <span className={`status ${badge.cls}`}>{badge.label}</span>
                <span className="product-modal-stock">
                  {maxQuantity > 0 ? `${maxQuantity} available` : "No stock available"}
                </span>
              </div>

              <p
                className={`product-modal-description${
                  product.description ? "" : " is-empty"
                }`}
              >
                {product.description || "No description provided."}
              </p>

              <div className="product-modal-actions">
                <label className="quantity-field">
                  <span>Qty</span>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(maxQuantity, 1)}
                    value={isAvailable ? quantity : 0}
                    disabled={!isAvailable}
                    onChange={(event) => onQuantityChange?.(product, event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="add-cart-btn"
                  disabled={!isAvailable}
                  onClick={() => onAddToCart?.(product)}
                >
                  <ShoppingCart size={15} />
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
