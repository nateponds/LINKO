import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, MapPin, Package, Search } from "lucide-react";
import { apiGet } from "../../lib/api";
import PaginationControls from "../../components/ui/PaginationControls";
import { readListUrlState, updateListUrlState } from "../../lib/pagination";
import { apiPath, normalizePage, shouldClampPage } from "./marketplacePagination";
import { hueOf, imageForSupplier, initialOf } from "../../lib/categoryImages";

/* Stock photo with a monogram fallback — an image that 404s or is blocked
   swaps to the business initial instead of leaving a broken tile. */
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

function SupplierGrid() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, q } = readListUrlState(searchParams);
  const category = searchParams.get("category") ?? "";
  const [searchInput, setSearchInput] = useState(q);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page, limit, total_items: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput === q) return;
      setSearchParams(updateListUrlState(searchParams, { q: searchInput }), { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, searchInput, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (hasLoaded) setFetching(true);
      else setLoading(true);
      setError(null);
      try {
        let categoryId;
        if (category) {
          const categories = await apiGet("/api/categories/options");
          categoryId = (Array.isArray(categories) ? categories : []).find(
            (item) => item.category_name === category,
          )?.category_id;
        }
        const data = await apiGet(apiPath("/api/suppliers", { q, page, limit, category_id: categoryId }));
        if (cancelled) return;
        const next = normalizePage(data);
        if (shouldClampPage(next.pagination)) {
          setSearchParams(updateListUrlState(searchParams, { page: next.pagination.total_pages }), { replace: true });
          return;
        }
        setSuppliers(next.items);
        setPagination(next.pagination);
        setHasLoaded(true);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setFetching(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [category, hasLoaded, limit, page, q, searchParams, setSearchParams]);

  function changeList(changes, replace = false) {
    setSearchParams(updateListUrlState(searchParams, changes), { replace });
  }

  function clearFilters() {
    const next = updateListUrlState(searchParams, { q: "", page: 1 });
    next.delete("category");
    setSearchParams(next);
  }

  const hasFilters = Boolean(category || q);
  if (loading && !hasLoaded) return <p className="grid-empty">Loading suppliers…</p>;
  if (error && !hasLoaded) return <p className="grid-empty">Could not load suppliers: {error}. Is the backend running?</p>;

  return (
    <section className="supplier-results" aria-busy={fetching}>
      <div className="supplier-results__tools">
        <label className="supplier-results__search">
          <span className="sr-only">Search suppliers</span>
          <Search size={16} aria-hidden="true" />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search suppliers" />
        </label>
        {hasFilters && (
          <div className="grid-filter-bar">
            <span>{pagination.total_items} supplier{pagination.total_items === 1 ? "" : "s"}{q && <> for “{q}”</>}{category && <> in <strong>{category}</strong></>}</span>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </div>

      {error && <p className="grid-empty" role="alert">Could not refresh suppliers: {error}</p>}
      {suppliers.length === 0 ? (
        <div className="grid-empty">
          <p>{hasFilters ? "No suppliers match these filters." : "No suppliers are available yet."}</p>
          {hasFilters && <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <section className="content-grid" aria-label="Supplier results">
          {suppliers.map((supplier) => (
            <Link to={`/suppliers/${supplier.business_id}`} className="supplier-box" key={supplier.business_id}>
              <SupplierImage businessId={supplier.business_id} businessName={supplier.business_name} />
              <div className="supplier-box-info">
                <h3>{supplier.business_name}{supplier.is_verified && <BadgeCheck size={16} className="verified-badge" aria-label="Verified" />}</h3>
                <p className="supplier-box-meta"><MapPin size={14} /> {supplier.city_municipality ?? supplier.city ?? "—"}</p>
                <p className="supplier-box-meta"><Package size={14} /> {supplier.product_count} product{supplier.product_count === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
      <PaginationControls pagination={pagination} onPageChange={(nextPage) => changeList({ page: nextPage })} onLimitChange={(nextLimit) => changeList({ limit: nextLimit })} disabled={fetching} ariaLabel="Supplier results pagination" className="supplier-results__pagination" />
    </section>
  );
}

export default SupplierGrid;
