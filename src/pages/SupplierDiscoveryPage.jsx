import "./SupplierDiscoveryPage.css";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import MarketplaceResults from "../features/search/MarketplaceResults";
import SupplierGrid from "../features/suppliers/SupplierGrid";
import MarketplaceProductCard from "../features/products/MarketplaceProductCard";
import { apiGet } from "../lib/api";
import { imageForCategory } from "../lib/categoryImages";
import { normalizePage } from "../features/suppliers/marketplacePagination";
import { CardGridSkeleton, WholesalerRowSkeleton } from "../components/ui/pageSkeletons";

const AVATAR_PALETTE = [
  "var(--color-primary)",
  "var(--color-accent-dark)",
  "var(--color-sunset)",
  "var(--color-plum)",
];

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
          <span className="home-wholesaler-name-text">{supplier.business_name}</span>
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
  const query = (searchParams.get("q") ?? "").trim();
  const isFiltered = query || searchParams.get("category");

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [promoLoaded, setPromoLoaded] = useState(false);

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
      } finally {
        if (!cancelled) setPromoLoaded(true);
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
            <section className="market-intro">
              <div className="market-intro__copy">
                <h1>Your next restock<br />starts here.</h1>
                <p>Find wholesale essentials and the people who supply them.</p>
                <a href="#browse-wholesalers" className="market-intro__link">Explore wholesalers <ArrowRight size={17} /></a>
              </div>
              <img src={imageForCategory("Produce", 800)} alt="Fresh produce available from wholesale suppliers" className="market-intro__image" />
            </section>

            {!promoLoaded ? (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>Featured products</h2>
                </div>
                <CardGridSkeleton count={5} label="Loading featured products" gridClassName="home-product-grid" />
              </section>
            ) : featuredProducts.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>Featured products</h2>
                  <a href="#browse-wholesalers">Browse wholesalers</a>
                </div>
                <div className="home-product-grid">
                  {featuredProducts.map((product) => (
                    <MarketplaceProductCard product={product} withCart key={product.product_id} />
                  ))}
                </div>
              </section>
            )}

            {!promoLoaded ? (
              <section className="home-section" id="top-wholesalers">
                <div className="home-section-head">
                  <h2>Wholesalers to know</h2>
                </div>
                <WholesalerRowSkeleton gridClassName="home-wholesaler-row" />
              </section>
            ) : topWholesalers.length > 0 && (
              <section className="home-section" id="top-wholesalers">
                <div className="home-section-head">
                  <h2>Wholesalers to know</h2>
                </div>
                <div className="home-wholesaler-row">
                  {topWholesalers.map((supplier, index) => (
                    <WholesalerCard supplier={supplier} index={index} key={supplier.business_id} />
                  ))}
                </div>
              </section>
            )}

            {!promoLoaded ? (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>More for your business</h2>
                </div>
                <CardGridSkeleton count={5} label="Loading products" gridClassName="home-product-grid" />
              </section>
            ) : moreProducts.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2>More for your business</h2>
                </div>
                <div className="home-product-grid">
                  {moreProducts.map((product) => (
                    <MarketplaceProductCard product={product} withCart key={product.product_id} />
                  ))}
                </div>
              </section>
            )}

            <div className="home-section-head home-section-head--browse" id="browse-wholesalers">
              <h2>All wholesalers</h2>
            </div>
          </>
        )}
        {query ? <MarketplaceResults /> : <SupplierGrid />}
      </div>
    </AppLayout>
  );
}

export default SupplierDiscoveryPage;
