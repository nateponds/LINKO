import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../cart/CartProvider";
import { isUnavailable } from "../cart/cart";
import ProductCard from "./ProductCard";

// Marketplace flavour of ProductCard: card tap and "View product" both go to the
// wholesaler page with the product detail modal open. withCart adds the Add button.
function MarketplaceProductCard({ product, withCart = false }) {
  const navigate = useNavigate();
  const { addProduct } = useCart();
  const [note, setNote] = useState(null);
  const href = `/suppliers/${product.business_id}?product_id=${product.product_id}`;

  function handleAdd() {
    const result = addProduct(product, 1);
    setNote(result.error ?? "Added to cart.");
  }

  return (
    <ProductCard product={product} showSupplier onOpen={() => navigate(href)}>
      <div className="home-product-actions">
        <Link to={href} className="home-product-cta">
          View product
        </Link>
        {withCart && (
          <button type="button" className="home-product-add" disabled={isUnavailable(product)} onClick={handleAdd}>
            <ShoppingCart size={14} />
            Add
          </button>
        )}
      </div>
      {withCart ? (
        <p className="home-product-note" role="status">{note}</p>
      ) : (
        // Empty spacer keeps the card's row count equal to the cart variant (subgrid alignment).
        <p className="home-product-note" aria-hidden="true" />
      )}
    </ProductCard>
  );
}

export default MarketplaceProductCard;
