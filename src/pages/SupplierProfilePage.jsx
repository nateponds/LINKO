import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  Leaf,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Repeat,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { useParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet, apiSend } from "../lib/api";
import { peso } from "../lib/format";
import "./SupplierProfilePage.css";

function stockBadge(status) {
  if (status === "out_of_stock") return { label: "Out of Stock", cls: "out-of-stock" };
  if (status === "low_stock") return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}

function stockLimit(product) {
  const stock = Number(product?.stock_quantity);
  if (!Number.isFinite(stock) || stock < 0) return 0;
  return Math.floor(stock);
}

function clampQuantity(value, max) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.floor(quantity), 1), max);
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
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [cart, setCart] = useState({});
  const [cartMessage, setCartMessage] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutConfirmation, setCheckoutConfirmation] = useState(null);

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

  const productsById = useMemo(() => {
    const byId = new Map();
    for (const product of products) {
      byId.set(String(product.product_id), product);
    }
    return byId;
  }, [products]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = productsById.get(productId);
          if (!product) return null;
          return {
            product,
            productId,
            quantity,
            lineTotal: Number(product.unit_price ?? 0) * quantity,
          };
        })
        .filter(Boolean),
    [cart, productsById],
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems],
  );

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedCategory(null);
  }

  function openCategory(name) {
    setSelectedCategory(name);
    setActiveTab("products");
  }

  function setProductDraft(product, value) {
    const max = stockLimit(product);
    setQuantityDrafts((current) => ({
      ...current,
      [product.product_id]: max > 0 ? clampQuantity(value, max) : 0,
    }));
  }

  function addToCart(product) {
    const max = stockLimit(product);
    if (max <= 0 || product.stock_status === "out_of_stock") {
      setCartMessage("That product is out of stock.");
      return;
    }

    const draftQuantity = quantityDrafts[product.product_id] ?? 1;
    const quantity = clampQuantity(draftQuantity, max);

    setCart((current) => {
      const key = String(product.product_id);
      const nextQuantity = Math.min((current[key] ?? 0) + quantity, max);
      return { ...current, [key]: nextQuantity };
    });
    setCartMessage(`${product.product_name} added to cart.`);
    setCheckoutError(null);
    setCheckoutConfirmation(null);
  }

  function updateCartQuantity(product, value) {
    const key = String(product.product_id);
    const max = stockLimit(product);
    if (max <= 0) {
      removeCartItem(key);
      return;
    }

    setCart((current) => ({
      ...current,
      [key]: clampQuantity(value, max),
    }));
    setCheckoutError(null);
  }

  function removeCartItem(productId) {
    setCart((current) => {
      const next = { ...current };
      delete next[String(productId)];
      return next;
    });
    setCheckoutError(null);
  }

  async function checkoutCart() {
    if (cartItems.length === 0 || checkingOut) return;

    setCheckingOut(true);
    setCheckoutError(null);
    setCartMessage(null);

    try {
      const order = await apiSend("/api/orders", {
        body: {
          items: cartItems.map(({ product, quantity }) => ({
            product_id: product.product_id,
            quantity,
          })),
        },
      });
      setCart({});
      setCheckoutConfirmation(order);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckingOut(false);
    }
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
            <main className="products-with-cart">
              <section className="product-grid">
                {visibleProducts.map((product) => {
                  const badge = stockBadge(product.stock_status);
                  const maxQuantity = stockLimit(product);
                  const isAvailable =
                    product.stock_status !== "out_of_stock" && maxQuantity > 0;
                  const draftQuantity = quantityDrafts[product.product_id] ?? 1;

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
                        <div className="product-stock">
                          {maxQuantity > 0 ? `${maxQuantity} available` : "No stock available"}
                        </div>
                        <div className="product-cart-controls">
                          <label className="quantity-field">
                            <span>Qty</span>
                            <input
                              type="number"
                              min="1"
                              max={Math.max(maxQuantity, 1)}
                              value={isAvailable ? draftQuantity : 0}
                              disabled={!isAvailable}
                              onChange={(event) =>
                                setProductDraft(product, event.target.value)
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="add-cart-btn"
                            disabled={!isAvailable}
                            onClick={() => addToCart(product)}
                          >
                            <ShoppingCart size={15} />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              <aside className="cart-panel" aria-label="Cart">
                <div className="cart-header">
                  <div>
                    <div className="cart-title">Cart</div>
                    <div className="cart-subtitle">
                      {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
                    </div>
                  </div>
                  <ShoppingCart size={20} />
                </div>

                {cartMessage && <p className="cart-note">{cartMessage}</p>}

                {cartItems.length === 0 ? (
                  <p className="cart-empty">Add products to prepare a checkout.</p>
                ) : (
                  <div className="cart-lines">
                    {cartItems.map(({ product, productId, quantity, lineTotal }) => {
                      const maxQuantity = stockLimit(product);
                      return (
                        <div className="cart-line" key={productId}>
                          <div className="cart-line-main">
                            <div className="cart-line-name">{product.product_name}</div>
                            <div className="cart-line-price">{peso(lineTotal)}</div>
                          </div>
                          <div className="cart-line-actions">
                            <div className="cart-stepper">
                              <button
                                type="button"
                                aria-label={`Decrease ${product.product_name}`}
                                onClick={() => updateCartQuantity(product, quantity - 1)}
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={Math.max(maxQuantity, 1)}
                                value={quantity}
                                onChange={(event) =>
                                  updateCartQuantity(product, event.target.value)
                                }
                              />
                              <button
                                type="button"
                                aria-label={`Increase ${product.product_name}`}
                                disabled={quantity >= maxQuantity}
                                onClick={() => updateCartQuantity(product, quantity + 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="remove-cart-btn"
                              aria-label={`Remove ${product.product_name}`}
                              onClick={() => removeCartItem(productId)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="cart-total-row">
                  <span>Subtotal</span>
                  <strong>{peso(cartSubtotal)}</strong>
                </div>

                {checkoutError && (
                  <p className="cart-error">Checkout failed: {checkoutError}</p>
                )}

                {checkoutConfirmation && (
                  <div className="checkout-confirmation">
                    <div className="confirmation-title">Order placed</div>
                    <div>Order #{checkoutConfirmation.order_id}</div>
                    <div>Status: {checkoutConfirmation.status}</div>
                    <div>Total: {peso(checkoutConfirmation.total)}</div>
                  </div>
                )}

                <button
                  type="button"
                  className="checkout-btn"
                  disabled={cartItems.length === 0 || checkingOut}
                  onClick={checkoutCart}
                >
                  {checkingOut ? "Checking out..." : "Checkout"}
                </button>
              </aside>
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
