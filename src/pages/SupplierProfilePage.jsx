import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Boxes,
  Check,
  Leaf,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Repeat,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import { peso, stockBadge } from "../lib/format";
import { bannersForProducts } from "../lib/productBanners";
import ProductDetailModal from "../components/ui/ProductDetailModal";
import PaginationControls from "../components/ui/PaginationControls";
import { readListUrlState, updateListUrlState } from "../lib/pagination";
import { apiPath, normalizePage, shouldClampPage } from "../features/suppliers/marketplacePagination";
import { useCart } from "../features/cart/CartProvider";
import { clampQuantity, stockLimit } from "../features/cart/cart";
import "./SupplierProfilePage.css";

export default function SupplierProfilePage() {
  const { supplierId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const productState = readListUrlState(searchParams, { prefix: "product" });
  const categoryState = readListUrlState(searchParams, { prefix: "category" });

  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 10, total_items: 0, total_pages: 0 });
  const [categoryPagination, setCategoryPagination] = useState({ page: 1, limit: 10, total_items: 0, total_pages: 0 });
  const [productError, setProductError] = useState(null);
  const [categoryError, setCategoryError] = useState(null);
  const [productsFetching, setProductsFetching] = useState(false);
  const [categoriesFetching, setCategoriesFetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { addProduct } = useCart();
  const [following, setFollowing] = useState(false);
  // A ?product_id= deep link must land on the products tab, not the shop tab.
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("product_id") ? "products" : "shop",
  );
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [cartMessage, setCartMessage] = useState(null);
  const [cartMessageOk, setCartMessageOk] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState(productState.q);
  const [categorySearchInput, setCategorySearchInput] = useState(categoryState.q);

  // Product detail modal state lives in the URL so the marketplace can deep-link
  // straight into it, and so browser back closes the modal instead of the page.
  const detailId = searchParams.get("product_id");
  const [detailFetched, setDetailFetched] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (productSearchInput !== productState.q) setSearchParams(updateListUrlState(searchParams, { q: productSearchInput }, { prefix: "product" }), { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearchInput, productState.q, searchParams, setSearchParams]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (categorySearchInput !== categoryState.q) setSearchParams(updateListUrlState(searchParams, { q: categorySearchInput }, { prefix: "category" }), { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [categorySearchInput, categoryState.q, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supplierData = await apiGet(`/api/suppliers/${encodeURIComponent(supplierId)}`);
        if (cancelled) return;
        setSupplier(supplierData ?? null);
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

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      setProductsFetching(true); setProductError(null);
      try {
        const data = await apiGet(apiPath("/api/products", { business_id: supplierId, q: productState.q, page: productState.page, limit: productState.limit, category_id: searchParams.get("product_category") }));
        if (cancelled) return;
        const next = normalizePage(data);
        if (shouldClampPage(next.pagination)) {
          setSearchParams(updateListUrlState(searchParams, { page: next.pagination.total_pages }, { prefix: "product" }), { replace: true });
          return;
        }
        setProducts(next.items); setProductPagination(next.pagination);
      } catch (err) { if (!cancelled) setProductError(err.message); }
      finally { if (!cancelled) setProductsFetching(false); }
    }
    loadProducts(); return () => { cancelled = true; };
  }, [productState.limit, productState.page, productState.q, searchParams, setSearchParams, supplierId]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      setCategoriesFetching(true); setCategoryError(null);
      try {
        const data = await apiGet(apiPath(`/api/suppliers/${encodeURIComponent(supplierId)}/categories`, { q: categoryState.q, page: categoryState.page, limit: categoryState.limit }));
        if (cancelled) return;
        const next = normalizePage(data);
        if (shouldClampPage(next.pagination)) {
          setSearchParams(updateListUrlState(searchParams, { page: next.pagination.total_pages }, { prefix: "category" }), { replace: true });
          return;
        }
        setCategories(next.items); setCategoryPagination(next.pagination);
      } catch (err) { if (!cancelled) setCategoryError(err.message); }
      finally { if (!cancelled) setCategoriesFetching(false); }
    }
    loadCategories(); return () => { cancelled = true; };
  }, [categoryState.limit, categoryState.page, categoryState.q, searchParams, setSearchParams, supplierId]);

  // Overrides the generic route title with the supplier's name.
  useEffect(() => {
    if (supplier) document.title = `${supplier.business_name} · LINKO`;
  }, [supplier]);

  // This supplier's own promo banner artwork, matched to their products.
  // Random order per visit; the first one becomes the shop hero.
  const heroBanner = useMemo(
    () => bannersForProducts(products)[0] ?? null,
    [products],
  );

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedCategory(null);
  }

  function openCategory(name) {
    setSelectedCategory(name.name);
    const next = updateListUrlState(searchParams, { page: 1 }, { prefix: "product" });
    next.set("product_category", name.category_id);
    setSearchParams(next);
    setActiveTab("products");
  }

  // Prefer the already-loaded row; the grid is paginated, so a deep-linked
  // product often is not on the current page and has to be fetched by id.
  const detailFromList = detailId
    ? products.find((p) => String(p.product_id) === String(detailId)) ?? null
    : null;
  // Keyed by id so a stale fetch from a previously-open product is ignored on
  // read rather than cleared by an effect.
  const detailProduct =
    detailFromList ??
    (detailFetched && String(detailFetched.product_id) === String(detailId)
      ? detailFetched
      : null);
  const needsDetailFetch = !!detailId && !detailFromList && !detailProduct;

  useEffect(() => {
    if (!needsDetailFetch) return;

    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const data = await apiGet(`/api/products/${encodeURIComponent(detailId)}`);
        if (cancelled) return;
        // Never render another supplier's product inside this shop.
        setDetailFetched(
          data && String(data.business_id) === String(supplierId) ? data : null,
        );
      } catch (err) {
        if (!cancelled) setDetailError(err.message);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [needsDetailFetch, detailId, supplierId]);

  function openProductDetail(product) {
    const next = new URLSearchParams(searchParams);
    next.set("product_id", product.product_id);
    setSearchParams(next);
    setActiveTab("products");
  }

  function closeProductDetail() {
    const next = new URLSearchParams(searchParams);
    next.delete("product_id");
    setSearchParams(next, { replace: true });
  }

  function setProductDraft(product, value) {
    const max = stockLimit(product);
    setQuantityDrafts((current) => ({
      ...current,
      [product.product_id]: max > 0 ? clampQuantity(value, max) : 0,
    }));
  }

  function addToCart(product) {
    const result = addProduct({
      ...product,
      business_id: product.business_id ?? supplier?.business_id ?? supplierId,
      business_name: product.business_name ?? supplier?.business_name ?? "Supplier",
    }, quantityDrafts[product.product_id] ?? 1);
    setCartMessageOk(!result.error);
    setCartMessage(result.error ?? `${product.product_name} added to cart.`);
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
            Could not load supplier: {error}
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
                src="https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&q=80&w=160"
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
                <span className="location">
                  <MapPin size={14} /> {supplier?.city ?? "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className={`btn-follow${following ? " following" : ""}`}
              onClick={() => setFollowing((v) => !v)}
            >
              {following ? (
                <>
                  Following <Check size={14} />
                </>
              ) : (
                <>
                  Follow <Plus size={14} />
                </>
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
            {heroBanner ? (
              <button
                type="button"
                className="shop-banner"
                onClick={() => switchTab("products")}
              >
                <img src={heroBanner.image} alt={heroBanner.alt} />
                <span className="shop-banner-btn" style={heroBanner.button}>
                  Shop Now →
                </span>
              </button>
            ) : (
              <div className="shop-hero">
                <div className="shop-hero-text">
                  <div className="shop-hero-tag">
                    <Leaf size={14} /> Fresh &amp; Local
                  </div>
                  <h1 className="shop-hero-title">
                    Quality you can taste, <br />
                    prices you&apos;ll love.
                  </h1>
                  <p className="shop-hero-sub">
                    Sourced from local farms and trusted partners — delivered
                    straight to your door.
                  </p>
                  <button
                    className="shop-hero-cta"
                    onClick={() => switchTab("products")}
                  >
                    Browse Products →
                  </button>
                </div>
                <div className="shop-hero-image" />
              </div>
            )}

            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-icon products">
                  <Boxes size={26} />
                </span>
                <div>
                  <span className="stat-value">{supplier?.product_count ?? productPagination.total_items}</span>
                  <span className="stat-label">Products</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon categories">
                  <Package size={26} />
                </span>
                <div>
                  <span className="stat-value">{supplier?.category_count ?? categoryPagination.total_items}</span>
                  <span className="stat-label">Categories</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon verified">
                  <BadgeCheck size={26} />
                </span>
                <div>
                  <span className="stat-value">
                    {supplier?.is_verified ? "Verified" : "Pending"}
                  </span>
                  <span className="stat-label">Supplier Status</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon location">
                  <MapPin size={26} />
                </span>
                <div>
                  <span className="stat-value">{supplier?.city ?? "—"}</span>
                  <span className="stat-label">Location</span>
                </div>
              </div>
            </div>

            <div className="shop-features">
              <div className="feature-card">
                <div className="feature-icon">
                  <Truck size={32} />
                </div>
                <div className="feature-title">Fast Delivery</div>
                <div className="feature-desc">
                  Same-day dispatch on orders placed before 12 PM.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <BadgeCheck size={32} />
                </div>
                <div className="feature-title">Quality Assured</div>
                <div className="feature-desc">
                  Every product is checked before it leaves our facility.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <MessageCircle size={32} />
                </div>
                <div className="feature-title">Always Here</div>
                <div className="feature-desc">
                  Our team is online 7 days a week to answer your questions.
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon">
                  <Repeat size={32} />
                </div>
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
          (products.length === 0 ? (
            <p className="grid-empty">This supplier has no products yet.</p>
          ) : (
            <section className="product-grid">
                {products.map((product) => {
                  const badge = stockBadge(product.stock_status);
                  const maxQuantity = stockLimit(product);
                  const isAvailable =
                    product.stock_status !== "out_of_stock" && maxQuantity > 0;
                  const draftQuantity = quantityDrafts[product.product_id] ?? 1;

                  return (
                    <div className="product-card" key={product.product_id}>
                      <button
                        type="button"
                        className="product-image product-detail-trigger"
                        aria-label={`View details for ${product.product_name}`}
                        onClick={() => openProductDetail(product)}
                      >
                        <img
                          src={
                            product.image_url ??
                            "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400"
                          }
                          alt={product.product_name}
                        />
                      </button>
                      <div className="product-details">
                        <button
                          type="button"
                          className="product-name product-detail-trigger"
                          onClick={() => openProductDetail(product)}
                        >
                          {product.product_name}
                        </button>
                        <div className="product-price">
                          {peso(product.unit_price)}
                        </div>
                        <span className={`status ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <div className="product-stock">
                          {maxQuantity > 0
                            ? `${maxQuantity} available`
                            : "No stock available"}
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
          ))}

        {activeTab === "products" && cartMessage && (
          <p className={cartMessageOk ? "cart-note" : "cart-error"} role="status">
            {cartMessage}
            {cartMessageOk && (
              <>
                {" "}
                <Link to="/cart">View cart</Link>
              </>
            )}
          </p>
        )}

        {activeTab === "products" && (
          <PaginationControls pagination={productPagination} disabled={productsFetching} onPageChange={(nextPage) => setSearchParams(updateListUrlState(searchParams, { page: nextPage }, { prefix: "product" }))} onLimitChange={(nextLimit) => setSearchParams(updateListUrlState(searchParams, { limit: nextLimit }, { prefix: "product" }))} ariaLabel="Supplier products pagination" className="supplier-profile-pagination" />
        )}

        {activeTab === "products" && <label className="supplier-list-search">Search products<input value={productSearchInput} onChange={(event) => setProductSearchInput(event.target.value)} /></label>}

        {activeTab === "products" && productError && <p className="grid-empty" role="alert">Could not load products: {productError}</p>}

        {activeTab === "categories" &&
          (categories.length === 0 ? (
            <p className="grid-empty">No categories yet.</p>
          ) : (
            <section className="category-grid">
              {categories.map((category) => (
                <button
                  type="button"
                  className="category-card"
                  key={category.category_id}
                  onClick={() => openCategory(category)}
                >
                  <div className="category-icon">
                    <Package size={32} />
                  </div>
                  <div className="category-name">{category.name}</div>
                </button>
              ))}
            </section>
          ))}
        {activeTab === "categories" && <label className="supplier-list-search">Search categories<input value={categorySearchInput} onChange={(event) => setCategorySearchInput(event.target.value)} /></label>}
        {activeTab === "categories" && categoryError && <p className="grid-empty" role="alert">Could not load categories: {categoryError}</p>}
        {activeTab === "categories" && <PaginationControls pagination={categoryPagination} disabled={categoriesFetching} onPageChange={(nextPage) => setSearchParams(updateListUrlState(searchParams, { page: nextPage }, { prefix: "category" }))} onLimitChange={(nextLimit) => setSearchParams(updateListUrlState(searchParams, { limit: nextLimit }, { prefix: "category" }))} ariaLabel="Supplier categories pagination" className="supplier-profile-pagination" />}

        <ProductDetailModal
          open={!!detailId}
          product={detailProduct}
          loading={detailLoading}
          error={detailError}
          quantity={detailProduct ? quantityDrafts[detailProduct.product_id] ?? 1 : 1}
          maxQuantity={stockLimit(detailProduct)}
          onQuantityChange={setProductDraft}
          onAddToCart={(product) => { addToCart(product); closeProductDetail(); }}
          onClose={closeProductDetail}
        />
      </div>
    </AppLayout>
  );
}
