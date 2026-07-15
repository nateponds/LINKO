import "./SupplierDiscoveryPage.css";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";
import { apiGet } from "../lib/api";
import { peso, stockBadge } from "../lib/format";
import { imageForCategory } from "../lib/categoryImages";

// Each promo banner is matched to a real product row (by name) so its button
// can deep-link to that product's supplier. `button` is the pill's position
// and size as percentages of the banner, tuned per image so it sits in the
// artwork's empty space (and covers the baked-in "Button Here" placeholder
// on images 6-8). Image 9 is a blank export, so it is not in the pool.
const BANNERS = [
  {
    image: "/images/productbanners/1.png",
    alt: "Pure fresh milk, by the crate",
    productMatch: "carabao milk",
    button: { left: "4.4%", bottom: "12%", width: "15%", height: "9.5%", background: "#2c5aa8", color: "#fff" },
  },
  {
    image: "/images/productbanners/2.png",
    alt: "Premium dried squid, sun-dried to perfection",
    productMatch: "dried pusit",
    button: { right: "3.5%", bottom: "12%", width: "15%", height: "9.5%", background: "#5a3f96", color: "#fff" },
  },
  {
    image: "/images/productbanners/3.png",
    alt: "Fresh calamansi juice, zest in every sip",
    productMatch: "calamansi juice",
    button: { left: "5.9%", bottom: "8%", width: "15%", height: "9.5%", background: "#4a8f2f", color: "#fff" },
  },
  {
    image: "/images/productbanners/4.png",
    alt: "Plump tiger prawns, fresh off the boat",
    productMatch: "tiger prawns",
    button: { right: "5.5%", bottom: "13%", width: "15%", height: "9.5%", background: "#a65b32", color: "#fff" },
  },
  {
    image: "/images/productbanners/5.png",
    alt: "Krispy chicharon, sarap for all",
    productMatch: "chicharon baboy",
    button: { left: "6%", bottom: "6.5%", width: "15%", height: "9.5%", background: "#c14b57", color: "#fff" },
  },
  {
    image: "/images/productbanners/6.png",
    alt: "Krispy chicharon, sarap for all",
    productMatch: "chicharon baboy",
    button: { left: "4.2%", bottom: "8.9%", width: "16%", height: "9.6%", background: "#f5b940", color: "#4a2a12" },
  },
  {
    image: "/images/productbanners/7.png",
    alt: "Sweet ripe mangoes, goodness in every bite",
    productMatch: "carabao mango",
    button: { left: "4.4%", bottom: "14.1%", width: "15.8%", height: "9.9%", background: "#e8872d", color: "#fff" },
  },
  {
    image: "/images/productbanners/8.png",
    alt: "Pure fresh milk, by the crate",
    productMatch: "carabao milk",
    button: { left: "5.7%", bottom: "14.9%", width: "15.7%", height: "9.9%", background: "#4a72c4", color: "#fff" },
  },
];

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Pick `count` banners advertising distinct products (some products have two
// banner variants), choosing randomly among variants, so the slots never
// promote the same thing twice and the selection changes between visits.
function pickRandomBanners(count) {
  const byProduct = new Map();
  for (const banner of shuffle(BANNERS)) {
    if (!byProduct.has(banner.productMatch)) {
      byProduct.set(banner.productMatch, banner);
    }
  }
  return shuffle([...byProduct.values()]).slice(0, count);
}

function PromoBanner({ banner, products, className = "" }) {
  const product = products.find((item) =>
    item.product_name?.toLowerCase().includes(banner.productMatch),
  );
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
  // Lazy initializer so the pick survives re-renders and only changes on a
  // fresh mount (i.e., navigating back to the page).
  const [banners] = useState(() => pickRandomBanners(2));

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
