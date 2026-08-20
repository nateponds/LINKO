import "./SupplierDiscoveryPage.css";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";
import { apiGet } from "../lib/api";
import { peso, stockBadge } from "../lib/format";
import { imageForCategory } from "../lib/categoryImages";
import { pickRandomBanners, productForBanner } from "../lib/productBanners";
import { normalizePage } from "../features/suppliers/marketplacePagination";

function PromoBanner({ banner, products, className = "" }) {
  const product = productForBanner(banner, products);
  const target = product ? `/suppliers/${product.business_id}` : "/suppliers";
  const { background, color, ...position } = banner.button;

  return (
    <section className={`home-banner ${className}`.trim()}>
      <Link to={target}>
        <img src={banner.image} alt={banner.alt} />
        <span className="home-banner-btn" style={{ ...position, background, color }}>
          Shop Now <ArrowRight size={16} />
        </span>
      </Link>
    </section>
  );
}

const AVATAR_PALETTE = [
  "var(--color-primary)",
  "var(--color-accent-dark)",
  "var(--color-sunset)",
  "var(--color-plum)",
];

function ProductCard({ product }) {
  const badge = stockBadge(product.stock_status);

  return (
    <div className="home-product-card">
      <div className="home-product-image">
        <img
          src={product.image_url ?? imageForCategory(product.category_name)}
          alt={product.product_name}
        />
        {product.category_name && (
          <span className="home-product-tag">{product.category_name}</span>
        )}
      </div>
      <div className="home-product-body">
        <p className="home-product-name">{product.product_name}</p>
        <p className="home-product-by">by {product.business_name}</p>
        <div className="home-product-meta">
          <span className="home-product-price">{peso(product.unit_price)}</span>
          <span className={`status ${badge.cls}`}>{badge.label}</span>
        </div>
        <Link
          to={`/suppliers/${product.business_id}?product_id=${product.product_id}`}
          className="home-product-cta"
        >
          View Product <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function WholesalerCard({ supplier, index }) {
  const initial = supplier.business_name?.charAt(0).toUpperCase() ?? "?";
  const accent = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

  return (
    <Link to={`/suppliers/${supplier.business_id}`} className="home-wholesaler-card">
      <span
        className="home-wholesaler-avatar"
        style={{
          background: `color-mix(in srgb, ${accent} 14%, white)`,
          color: accent,
        }}
      >
        {initial}
      </span>
      <span className="home-wholesaler-info">
        <span className="home-wholesaler-name">
          {supplier.business_name}
          {supplier.is_verified && <BadgeCheck size={15} className="verified-badge" />}
        </span>
        <span className="home-wholesaler-meta">
          {supplier.product_count} product{supplier.product_count === 1 ? "" : "s"}
        </span>
      </span>
      <ArrowRight size={16} className="home-wholesaler-arrow" />
    </Link>
  );
}

function SupplierDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const isFiltered = searchParams.get("q") || searchParams.get("category");

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  // Lazy initializer so the pick survives re-renders and only changes on a
  // fresh mount (i.e., navigating back to the page).
  const [banners] = useState(() => pickRandomBanners(2));

  useEffect(() => {
    if (isFiltered) return undefined;

    let cancelled = false;
    async function load() {
      try {
        const [productList, supplierList] = await Promise.all([
          apiGet("/api/products?limit=10"),
          apiGet("/api/suppliers?limit=10"),
        ]);
        if (cancelled) return;
        setProducts(normalizePage(productList).items);
        setSuppliers(normalizePage(supplierList).items);
      } catch {
        // Home promo content is a nice-to-have; the supplier grid below
        // still works if this fails, so fail silently here.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isFiltered]);

  const featuredProducts = products.slice(0, 5);
  const moreProducts = products.slice(5, 10);
  const topWholesalers = [...suppliers]
    .sort((a, b) => (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0))
    .slice(0, 4);

  return (
    <AppLayout showSubNav showSearch showCategories>
      <div className="discovery-page">
        {!isFiltered && (
          <>
            <PromoBanner
              banner={banners[0]}
              products={products}
              className="home-banner--hero"
            />

            {featuredProducts.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>Featured Products</h2>
                  <Link to="/">Browse all wholesalers</Link>
                </div>
                <div className="home-product-grid">
                  {featuredProducts.map((product) => (
                    <ProductCard product={product} key={product.product_id} />
                  ))}
                </div>
              </section>
            )}

            {topWholesalers.length > 0 && (
              <section className="home-section" id="top-wholesalers">
                <div className="home-section-head">
                  <h2>Top Wholesalers</h2>
                </div>
                <div className="home-wholesaler-row">
                  {topWholesalers.map((supplier, index) => (
                    <WholesalerCard supplier={supplier} index={index} key={supplier.business_id} />
                  ))}
                </div>
              </section>
            )}

            <PromoBanner banner={banners[1]} products={products} />

            {moreProducts.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>More From Our Wholesalers</h2>
                </div>
                <div className="home-product-grid">
                  {moreProducts.map((product) => (
                    <ProductCard product={product} key={product.product_id} />
                  ))}
                </div>
              </section>
            )}

            <div className="home-section-head home-section-head--browse">
              <h2>Browse All Wholesalers</h2>
            </div>
          </>
        )}
        <SupplierGrid />
      </div>
    </AppLayout>
  );
}

export default SupplierDiscoveryPage;
