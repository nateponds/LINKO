import { ShoppingCart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { ROUTE_ACCESS } from "../../auth/roleAccess";
import { useCart } from "../cart/CartProvider";
import { isUnavailable } from "../cart/cart";
import ProductCard from "./ProductCard";

// Marketplace flavour of ProductCard: card tap and "View product" both go to the
// wholesaler page with the product detail modal open. withCart adds the Add button
// for callers who may use the cart.
function MarketplaceProductCard({ product, withCart: wantsCart = false }) {
  const { hasAnyRole } = useAuth();
  const withCart = wantsCart && hasAnyRole(ROUTE_ACCESS["/cart"]);
  const navigate = useNavigate();
  const { addProduct } = useCart();
  const href = `/suppliers/${product.business_id}?product_id=${product.product_id}`;

  function handleAdd() {
    addProduct(product, 1);
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
      {/* Reserve the final row so product cards stay aligned. */}
      <p className="home-product-note" aria-hidden="true" />
    </ProductCard>
  );
}

export default MarketplaceProductCard;
