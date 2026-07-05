import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Leaf,
  MessageCircle,
  Package,
  Plus,
  Repeat,
  Truck,
} from "lucide-react";
import { useParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import { peso } from "../lib/format";
import "./SupplierProfilePage.css";

function stockBadge(status) {
  if (status === "out_of_stock") return { label: "Out of Stock", cls: "out-of-stock" };
  if (status === "low_stock") return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}

export default function SupplierProfilePage() {
  const { supplierId } = useParams();

  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("shop");
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [suppliers, productList] = await Promise.all([
          apiGet("/api/suppliers"),
          apiGet(`/api/products?business_id=${encodeURIComponent(supplierId)}`),
        ]);
        if (cancelled) return;
        const match = (Array.isArray(suppliers) ? suppliers : []).find(
          (s) => String(s.business_id) === String(supplierId),
        );
        setSupplier(match ?? null);
        setProducts(Array.isArray(productList) ? productList : []);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  // Overrides the generic route title with the supplier's name.
  useEffect(() => {
    if (supplier) document.title = `${supplier.business_name} · LINKO`;
  }, [supplier]);

  // Distinct categories present in this supplier's products.
  const categories = useMemo(() => {
    const seen = new Map();
    for (const p of products) {
      if (p.category_name && !seen.has(p.category_name)) {
        seen.set(p.category_name, p.category_name);
      }
    }
    return [...seen.keys()];
  }, [products]);

  const visibleProducts = selectedCategory
    ? products.filter((p) => p.category_name === selectedCategory)
    : products;

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedCategory(null);
  }

  function openCategory(name) {
    setSelectedCategory(name);
    setActiveTab("products");
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="supplier-profile-page">
          <p className="grid-empty">Loading supplier…</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="supplier-profile-page">
          <p className="grid-empty">
            Could not load supplier: {error}. Is the backend running?
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="supplier-profile-page">
        <section className="profile-bar">
          <div className="profile-info">
            <button className="circle-btn">
              <img
                src="https://loremflickr.com/160/160/store"
                alt={`${supplier?.business_name ?? "Supplier"} profile photo`}
              />
            </button>
            <div className="profile-text">
              <div className="supplier-name">
                {supplier?.business_name ?? "Supplier"}
                {supplier?.is_verified && (
                  <BadgeCheck size={18} aria-label="Verified" />
                )}
              </div>
              <div className="supplier-meta">
                <span className="location">{supplier?.city ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className={`btn-follow${following ? " following" : ""}`}
              onClick={() => setFollowing((v) => !v)}
            >
              {following ? (
                <>Following <Check size={14} /></>
              ) : (
                <>Follow <Plus size={14} /></>
              )}
            </button>
            <button className="btn-chat">
              Chat <MessageCircle size={16} />
            </button>
          </div>
        </section>

        <nav className="tab-nav">
          {["shop", "products", "categories"].map((tab) => (
            <button
              key={tab}
              className={`tab-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => switchTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab === "shop" && (
          <section className="shop-section">
            <div className="shop-hero">
              <div className="shop-hero-text">
                <div className="shop-hero-tag"><Leaf size={14} /> Fresh &amp; Local</div>
                <h1 className="shop-hero-title">
                  Quality you can taste, <br />prices you&apos;ll love.
                </h1>
                <p className="shop-hero-sub">
                  Sourced from local farms and trusted partners — delivered straight
                  to your door.
                </p>
                <button className="shop-hero-cta" onClick={() => switchTab("products")}>
                  Browse Products →
                </button>
              </div>
              <div className="shop-hero-image" />
            </div>

            <div className="shop-stats">
              <div className="stat-item">
                <div className="stat-number">{products.length}</div>
                <div className="stat-label">Products</div>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <div className="stat-number">{categories.length}</div>
                <div className="stat-label">Categories</div>
              </div>
            </div>

            <div className="shop-features">
              <div className="feature-card">
                <div className="feature-icon"><Truck size={28} /></div>
                <div className="feature-title">Fast Delivery</div>
                <div className="feature-desc">
                  Same-day dispatch on orders placed before 12 PM.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><BadgeCheck size={28} /></div>
                <div className="feature-title">Quality Assured</div>
                <div className="feature-desc">
                  Every product is checked before it leaves our facility.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><MessageCircle size={28} /></div>
                <div className="feature-title">Always Here</div>
                <div className="feature-desc">
                  Our team is online 7 days a week to answer your questions.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><Repeat size={28} /></div>
                <div className="feature-title">Easy Returns</div>
                <div className="feature-desc">
                  Not satisfied? We&apos;ll sort it — no questions asked.
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "products" && selectedCategory && (
          <div className="category-back-bar">
            <button
              className="category-back-btn"
              onClick={() => switchTab("categories")}
            >
              ← Back to Categories
            </button>
          </div>
        )}

        {activeTab === "products" &&
          (visibleProducts.length === 0 ? (
            <p className="grid-empty">This supplier has no products yet.</p>
          ) : (
            <main className="product-grid">
              {visibleProducts.map((product) => {
                const badge = stockBadge(product.stock_status);
                return (
                  <div className="product-card" key={product.product_id}>
                    <div className="product-image">
                      <img
                        src={
                          product.image_url ??
                          "https://loremflickr.com/400/300/food,product"
                        }
                        alt={product.product_name}
                      />
                    </div>
                    <div className="product-details">
                      <div className="product-name">{product.product_name}</div>
                      <div className="product-price">{peso(product.unit_price)}</div>
                      <span className={`status ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </div>
                );
              })}
            </main>
          ))}

        {activeTab === "categories" &&
          (categories.length === 0 ? (
            <p className="grid-empty">No categories yet.</p>
          ) : (
            <section className="category-grid">
              {categories.map((name) => (
                <button
                  type="button"
                  className="category-card"
                  key={name}
                  onClick={() => openCategory(name)}
                >
                  <div className="category-icon"><Package size={32} /></div>
                  <div className="category-name">{name}</div>
                </button>
              ))}
            </section>
          ))}
      </div>
    </AppLayout>
  );
}
