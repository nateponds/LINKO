import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { findSupplier } from "../data/suppliers";
import "./SupplierProfilePage.css";

/* Placeholder catalog data, converted from supplier_profile.js.
   Replace with API calls keyed by the supplier slug later. */
const CATEGORIES = [
  { name: "Breads & Bakery", icon: "🍞" },
  { name: "Beverages", icon: "🥤" },
  { name: "Dairy & Eggs", icon: "🥚" },
  { name: "Snacks", icon: "🍿" },
  { name: "Canned & Packaged", icon: "🥫" },
  { name: "Coffee & Tea", icon: "☕" },
];

const PRODUCTS = [
  { name: "Whole Grain Bread", price: 85, category: "Breads & Bakery" },
  { name: "Fresh Orange Juice 1L", price: 120, category: "Beverages" },
  { name: "Organic Eggs (12pcs)", price: 150, category: "Dairy & Eggs" },
  { name: "Cheddar Cheese Block", price: 220, category: "Dairy & Eggs" },
  { name: "Sparkling Water 6-Pack", price: 180, category: "Beverages" },
  { name: "Roasted Coffee Beans 250g", price: 280, category: "Coffee & Tea" },
];

export default function SupplierProfilePage() {
  const { supplierSlug } = useParams();
  const supplier = findSupplier(supplierSlug);

  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState("shop");
  // Category drill-down: when set, the products grid is filtered and a back bar shows.
  const [selectedCategory, setSelectedCategory] = useState(null);

  const visibleProducts = selectedCategory
    ? PRODUCTS.filter((p) => p.category === selectedCategory)
    : PRODUCTS;

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedCategory(null);
  }

  function openCategory(name) {
    setSelectedCategory(name);
    setActiveTab("products");
  }

  return (
    <div className="supplier-profile-page">
      <header className="header-nav">
        <div className="logo">Linko</div>

        <div className="search">
          <input type="text" placeholder="Search in store" />
          <button className="icon-btn search-btn" aria-label="Search">🔍</button>
        </div>

        <div className="header-actions">
          <button className="icon-action" aria-label="Notifications">🔔</button>
          <button
            className="icon-action"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <button className="icon-action" aria-label="Others" />
          {/* contains: share, block, report */}
        </div>
      </header>

      <div className="menu-overlay" style={{ width: menuOpen ? "250px" : "0" }}>
        <button className="close-btn" onClick={() => setMenuOpen(false)}>✕</button>
        <nav className="menu-items">
          <Link to="/">Home</Link>
          <Link to="/inventory">Inventory</Link>
          <a href="#">Dashboard</a>
          <a href="#">Wait List</a>
          <a href="#">Orders</a>
          <Link to="/invoices">Invoices</Link>
          <a href="#" className="logout">Logout</a>
        </nav>
      </div>

      <section className="profile-bar">
        <div className="profile-info">
          <button className="circle-btn">
            <img
              src={supplier?.supplier_image ?? "https://loremflickr.com/160/160/store"}
              alt={`${supplier?.supplier_name ?? "Supplier"} profile photo`}
            />
          </button>
          <div className="profile-text">
            <div className="supplier-name">
              {supplier?.supplier_name ?? "Supplier Name"}
            </div>
            <div className="supplier-meta">
              <span className="ratings">★ {supplier ? supplier.rating.toFixed(1) : "4.8"}</span>
              <span className="meta-divider">|</span>
              <span className="location">{supplier?.location ?? "Location"}</span>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button
            className={`btn-follow${following ? " following" : ""}`}
            onClick={() => setFollowing((v) => !v)}
          >
            {following ? (
              <>Following <span className="plus">✓</span></>
            ) : (
              <>Follow <span className="plus">+</span></>
            )}
          </button>
          <button className="btn-chat">
            Chat <span className="chat-icon">💬</span>
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
          {/* Hero banner */}
          <div className="shop-hero">
            <div className="shop-hero-text">
              <div className="shop-hero-tag">🌿 Fresh &amp; Local</div>
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

          {/* Stats row */}
          <div className="shop-stats">
            <div className="stat-item">
              <div className="stat-number">500+</div>
              <div className="stat-label">Products</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">
                {supplier ? `${supplier.rating.toFixed(1)}★` : "4.8★"}
              </div>
              <div className="stat-label">Average Rating</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">2,000+</div>
              <div className="stat-label">Happy Customers</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">Since 2018</div>
              <div className="stat-label">In Business</div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="shop-features">
            <div className="feature-card">
              <div className="feature-icon">🚚</div>
              <div className="feature-title">Fast Delivery</div>
              <div className="feature-desc">
                Same-day dispatch on orders placed before 12 PM.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">✅</div>
              <div className="feature-title">Quality Assured</div>
              <div className="feature-desc">
                Every product is checked before it leaves our facility.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <div className="feature-title">Always Here</div>
              <div className="feature-desc">
                Our team is online 7 days a week to answer your questions.
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔁</div>
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

      {activeTab === "products" && (
        <main className="product-grid">
          {visibleProducts.map((product) => (
            <div className="product-card" key={product.name}>
              <div className="product-image" />
              <div className="product-details">
                <div className="product-name">{product.name}</div>
                <div className="product-price">₱{product.price.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </main>
      )}

      {activeTab === "categories" && (
        <section className="category-grid">
          {CATEGORIES.map((category) => (
            <div
              className="category-card"
              key={category.name}
              onClick={() => openCategory(category.name)}
            >
              <div className="category-icon">{category.icon}</div>
              <div className="category-name">{category.name}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
