import "./ProductCard.css";
import { imageForCategory } from "../../lib/categoryImages";
import { peso, stockBadge } from "../../lib/format";

// Shared product card (wholesaler merchandise page + marketplace). The whole
// card opens the product via onOpen; anything passed as children renders in the
// actions row (cart controls, View Product link, ...) and does NOT trigger it.
function ProductCard({ product, onOpen, showSupplier = false, stockText, children }) {
  const badge = stockBadge(product.stock_status);

  function handleClick(event) {
    if (event.target.closest(".product-card__actions")) return;
    onOpen(product);
  }

  return (
    <div className="product-card" onClick={handleClick}>
      <div className="product-card__image">
        <img src={product.image_url ?? imageForCategory(product.category_name)} alt={product.product_name} />
        {showSupplier && product.category_name && <span className="product-card__tag">{product.category_name}</span>}
      </div>
      <div className="product-card__body">
        {/* The name is the keyboard stop; its click bubbles to the card handler. */}
        <button type="button" className="product-card__name" title={product.product_name}>
          {product.product_name}
        </button>
        {showSupplier && <p className="product-card__by" title={product.business_name}>by {product.business_name}</p>}
        <div className="product-card__meta">
          <span className="product-card__price">{peso(product.unit_price)}</span>
          <span className={`status ${badge.cls}`}>{badge.label}</span>
        </div>
        {stockText && <div className="product-card__stock">{stockText}</div>}
        {children && <div className="product-card__actions">{children}</div>}
      </div>
    </div>
  );
}

export default ProductCard;
