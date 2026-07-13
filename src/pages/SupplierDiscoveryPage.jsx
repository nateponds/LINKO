import "./SupplierDiscoveryPage.css";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Handshake,
  MapPin,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";
import { apiGet } from "../lib/api";
import { peso, stockBadge } from "../lib/format";
import { imageForCategory } from "../lib/categoryImages";

const VALUE_PROPS = [
  { Icon: MapPin, text: "Wholesalers matched to your location" },
  { Icon: Handshake, text: "Direct buyer-wholesaler connections" },
  { Icon: ShieldCheck, text: "Verified supplier profiles" },
];

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
        <Link to={`/suppliers/${product.business_id}`} className="home-product-cta">
          View Product <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function WholesalerCard({ supplier, index }) {
  const initial = supplier.business_name?.charAt(0).toUpperCase() ?? "?";

  return (
    <Link to={`/suppliers/${supplier.business_id}`} className="home-wholesaler-card">
      <span
        className="home-wholesaler-avatar"
        style={{ background: AVATAR_PALETTE[index % AVATAR_PALETTE.length] }}
      >
        {initial}
      </span>
      <span className="home-wholesaler-name">
        {supplier.business_name}
        {supplier.is_verified && <BadgeCheck size={14} className="verified-badge" />}
      </span>
      <span className="home-wholesaler-meta">
        {supplier.product_count} product{supplier.product_count === 1 ? "" : "s"}
      </span>
    </Link>
  );
}

function SupplierDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const isFiltered = searchParams.get("q") || searchParams.get("category");

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    if (isFiltered) return undefined;

    let cancelled = false;
    async function load() {
      try {
        const [productList, supplierList] = await Promise.all([
          apiGet("/api/products"),
          apiGet("/api/suppliers"),
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(productList) ? productList : []);
        setSuppliers(Array.isArray(supplierList) ? supplierList : []);
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
    <AppLayout showSubNav showSearch>
      <div className="discovery-page">
        {!isFiltered && (
          <>
            <section className="home-hero-row">
              <div className="home-hero home-hero--primary">
                <div>
                  <span className="home-hero-eyebrow">LINKO Marketplace</span>
                  <h1>Wholesale for your business, sourced nearby</h1>
                  <p>
                    Browse trusted wholesalers and compare offers from
                    suppliers close to you.
                  </p>
                </div>
                <Link to="/suppliers" className="hero-cta">
                  Browse wholesalers <ArrowRight size={16} />
                </Link>
              </div>

              <div className="home-hero-stack">
                <Link to="/become-a-supplier" className="home-hero home-hero--sell">
                  <Sprout size={22} />
                  <div>
                    <h2>Got inventory to move?</h2>
                    <p>List your business and start getting orders.</p>
                  </div>
                  <span className="hero-cta hero-cta--ghost">
                    Become a Supplier <ArrowRight size={14} />
                  </span>
                </Link>

                <div className="home-hero home-hero--trust">
                  <ShieldCheck size={22} />
                  <div>
                    <h2>Verified &amp; reliable</h2>
                    <p>Every wholesaler is reviewed before they can list.</p>
                  </div>
                </div>
              </div>
            </section>

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

            <section className="home-value-banner">
              <h2>Built for trust, priced for growth.</h2>
              <ul>
                {VALUE_PROPS.map(({ Icon, text }) => (
                  <li key={text}>
                    <Icon size={18} /> {text}
                  </li>
                ))}
              </ul>
            </section>

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

            <section className="home-cta-banner">
              <div>
                <span className="home-hero-eyebrow home-hero-eyebrow--dark">Only on LINKO</span>
                <h2>Turn your inventory into orders</h2>
                <p>Join the wholesalers already selling to buyers near them.</p>
              </div>
              <Link to="/become-a-supplier" className="hero-cta">
                Become a Supplier <ArrowRight size={16} />
              </Link>
            </section>

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
