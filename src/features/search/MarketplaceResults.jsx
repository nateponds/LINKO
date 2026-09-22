import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, MapPin, Package, Search } from "lucide-react";
import PaginationControls from "../../components/ui/PaginationControls";
import { apiGet } from "../../lib/api";
import { hueOf, imageForCategory, imageForSupplier, initialOf } from "../../lib/categoryImages";
import { peso, stockBadge } from "../../lib/format";
import { readListUrlState, updateListUrlState } from "../../lib/pagination";
import { apiPath, normalizePage, shouldClampPage } from "../suppliers/marketplacePagination";
import { normalizeSearchQuery, searchParamsWithoutQuery } from "./marketplaceSearch.js";

function SupplierImage({ businessId, businessName }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="supplier-box-image supplier-box-image--monogram" style={{ "--avatar-hue": hueOf(businessName) }} aria-hidden="true">
        {initialOf(businessName)}
      </div>
    );
  }
  return (
    <div className="supplier-box-image">
      <img src={imageForSupplier(businessId)} alt="" onError={() => setFailed(true)} />
    </div>
  );
}

function ProductResult({ product }) {
  const badge = stockBadge(product.stock_status);
  return (
    <div className="home-product-card">
      <div className="home-product-image">
        <img src={product.image_url ?? imageForCategory(product.category_name)} alt={product.product_name} />
        {product.category_name && <span className="home-product-tag">{product.category_name}</span>}
      </div>
      <div className="home-product-body">
        <p className="home-product-name">{product.product_name}</p>
        <p className="home-product-by">by {product.business_name}</p>
        <div className="home-product-meta">
          <span className="home-product-price">{peso(product.unit_price)}</span>
          <span className={`status ${badge.cls}`}>{badge.label}</span>
        </div>
        <Link to={`/suppliers/${product.business_id}?product_id=${product.product_id}`} className="home-product-cta">
          View Product
        </Link>
      </div>
    </div>
  );
}

function MarketplaceResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = normalizeSearchQuery(searchParams.get("q") ?? "");
  const category = searchParams.get("category") ?? "";
  const productList = readListUrlState(searchParams, { prefix: "product" });
  const supplierList = readListUrlState(searchParams, { prefix: "supplier" });
  const [resolvedCategory, setResolvedCategory] = useState(null);
  const categoryReady = !category || resolvedCategory?.name === category;
  const categoryId = categoryReady ? resolvedCategory?.id : undefined;
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: productList.page, limit: productList.limit, total_items: 0, total_pages: 0 });
  const [supplierPagination, setSupplierPagination] = useState({ page: supplierList.page, limit: supplierList.limit, total_items: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!category) return undefined;
    let cancelled = false;
    async function loadCategory() {
      try {
        const categories = await apiGet("/api/categories/options");
        if (cancelled) return;
        const match = (Array.isArray(categories) ? categories : []).find((item) => item.category_name === category);
        setResolvedCategory({ name: category, id: match?.category_id });
      } catch {
        if (!cancelled) setResolvedCategory({ name: category, id: undefined });
      }
    }
    loadCategory();
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    if (!categoryReady || !q) return undefined;
    let cancelled = false;
    async function load() {
      let clamped = false;
      setLoading(true);
      setError(null);
      try {
        const [productPage, supplierPage] = await Promise.all([
          apiGet(apiPath("/api/products", { q, page: productList.page, limit: productList.limit, category_id: categoryId })),
          apiGet(apiPath("/api/suppliers", { q, page: supplierList.page, limit: supplierList.limit, category_id: categoryId })),
        ]);
        if (cancelled) return;
        const nextProducts = normalizePage(productPage);
        const nextSuppliers = normalizePage(supplierPage);
        if (shouldClampPage(nextProducts.pagination)) {
          clamped = true;
          setSearchParams(updateListUrlState(searchParams, { page: nextProducts.pagination.total_pages }, { prefix: "product" }), { replace: true });
          return;
        }
        if (shouldClampPage(nextSuppliers.pagination)) {
          clamped = true;
          setSearchParams(updateListUrlState(searchParams, { page: nextSuppliers.pagination.total_pages }, { prefix: "supplier" }), { replace: true });
          return;
        }
        setProducts(nextProducts.items);
        setProductPagination(nextProducts.pagination);
        setSuppliers(nextSuppliers.items);
        setSupplierPagination(nextSuppliers.pagination);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled && !clamped) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [categoryId, categoryReady, productList.limit, productList.page, q, searchParams, setSearchParams, supplierList.limit, supplierList.page]);

  function changeList(prefix, changes) {
    setSearchParams(updateListUrlState(searchParams, changes, { prefix }));
  }

  function clearSearch() {
    setSearchParams(searchParamsWithoutQuery(searchParams));
  }

  const bothEmpty = !loading && !error && products.length === 0 && suppliers.length === 0;
  const scope = category ? <> in <strong>{category}</strong></> : null;

  return (
    <section className="marketplace-results" aria-busy={loading}>
      <div className="marketplace-results__head">
        <div>
          <h2>Search results for “{q}”</h2>
          {category && <p>Filtered by {category}</p>}
        </div>
        <button type="button" className="link-button" onClick={clearSearch}>Clear search</button>
      </div>

      {loading && <p className="grid-empty">Searching products and suppliers…</p>}
      {error && <p className="grid-empty" role="alert">Could not load search results: {error}</p>}
      {bothEmpty && (
        <div className="marketplace-results__empty">
          <Search size={28} aria-hidden="true" />
          <h3>No matches for “{q}”</h3>
          <p>No products or suppliers match this search{scope}.</p>
          <button type="button" className="link-button" onClick={clearSearch}>Clear search</button>
        </div>
      )}

      {!loading && !error && !bothEmpty && (
        <>
          <section className="home-section" aria-label="Matching products">
            <div className="home-section-head">
              <h2>Products ({productPagination.total_items})</h2>
            </div>
            {products.length === 0 ? (
              <p className="grid-empty">No products match “{q}”{scope}.</p>
            ) : (
              <div className="home-product-grid">
                {products.map((product) => <ProductResult product={product} key={product.product_id} />)}
              </div>
            )}
            <PaginationControls
              pagination={productPagination}
              onPageChange={(page) => changeList("product", { page })}
              onLimitChange={(limit) => changeList("product", { limit })}
              ariaLabel="Product results pagination"
              className="marketplace-results__pagination"
            />
          </section>

          <section className="home-section" aria-label="Matching suppliers">
            <div className="home-section-head">
              <h2>Suppliers ({supplierPagination.total_items})</h2>
            </div>
            {suppliers.length === 0 ? (
              <p className="grid-empty">No suppliers match “{q}”{scope}.</p>
            ) : (
              <div className="content-grid marketplace-results__suppliers">
                {suppliers.map((supplier) => (
                  <Link to={`/suppliers/${supplier.business_id}`} className="supplier-box" key={supplier.business_id}>
                    <SupplierImage businessId={supplier.business_id} businessName={supplier.business_name} />
                    <div className="supplier-box-info">
                      <h3>
                        {supplier.business_name}
                        {supplier.is_verified && <BadgeCheck size={16} className="verified-badge" aria-label="Verified" />}
                      </h3>
                      <p className="supplier-box-meta"><MapPin size={14} /> {supplier.city_municipality ?? supplier.city ?? "—"}</p>
                      <p className="supplier-box-meta"><Package size={14} /> {supplier.product_count} product{supplier.product_count === 1 ? "" : "s"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <PaginationControls
              pagination={supplierPagination}
              onPageChange={(page) => changeList("supplier", { page })}
              onLimitChange={(limit) => changeList("supplier", { limit })}
              ariaLabel="Supplier results pagination"
              className="marketplace-results__pagination"
            />
          </section>
        </>
      )}
    </section>
  );
}

export default MarketplaceResults;
