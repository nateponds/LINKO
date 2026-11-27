import { useEffect, useRef, useState } from "react";
import { Link, useNavigationType, useSearchParams } from "react-router-dom";
import { BadgeCheck, MapPin, Package } from "lucide-react";
import { apiGet } from "../../lib/api";
import PaginationControls from "../../components/ui/PaginationControls";
import SearchField from "../../components/ui/SearchField";
import { useListUrlState } from "../../hooks/useListUrlState";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { apiPath, normalizePage, shouldClampPage } from "./marketplacePagination";
import { hueOf, imageForSupplier, initialOf } from "../../lib/categoryImages";
import { SupplierCardGridSkeleton } from "../../components/ui/pageSkeletons";

const LIST_OPTIONS = { prefix: "supplier" };

/* Stock photo with a monogram fallback - an image that 404s or is blocked
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
  const [searchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const { page, limit, q, update, setPage, setLimit } = useListUrlState(LIST_OPTIONS);
  const category = searchParams.get("category") ?? "";
  const [draft, setDraft] = useState({ q, value: q, edited: false });
  if (draft.q !== q) {
    // A local URL update may finish after the user has started typing again.
    const keepDraft = navigationType !== "POP" && draft.edited && draft.value.trim() !== q;
    setDraft({ q, value: keepDraft ? draft.value : q, edited: keepDraft });
  }
  const settled = useDebouncedValue(draft, 300);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page, limit, total_items: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const value = settled.value.trim();
    if (settled === draft && settled.q === q && value !== q) update({ q: value }, { replace: true });
  }, [draft, q, settled, update]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load() {
      if (hasLoaded.current) setFetching(true);
      else setLoading(true);
      setError(false);
      try {
        let categoryId;
        if (category) {
          const categories = await apiGet("/api/categories/options", { signal });
          categoryId = (Array.isArray(categories) ? categories : []).find(
            (item) => item.category_name === category,
          )?.category_id;
        }
        const data = await apiGet(apiPath("/api/suppliers", { q, page, limit, category_id: categoryId }), { signal });
        if (signal.aborted) return;
        const next = normalizePage(data);
        if (shouldClampPage(next.pagination)) {
          update({ page: next.pagination.total_pages }, { replace: true });
          return;
        }
        setSuppliers(next.items);
        setPagination(next.pagination);
        hasLoaded.current = true;
      } catch {
        if (!signal.aborted) setError(true);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setFetching(false);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [category, limit, page, q, retryCount, update]);

  function submitSearch(value) {
    const query = value.trim();
    setDraft({ q, value: query, edited: true });
    update({ q: query }, { replace: true });
  }

  function clearFilters() {
    setDraft({ q, value: "", edited: true });
    update({ q: "", filters: { category: null } });
  }

  const hasFilters = Boolean(category || q);

  return (
    <section className="supplier-results" aria-busy={fetching}>
      <div className="supplier-results__tools">
        <SearchField
          className="supplier-results__search"
          value={draft.value}
          onChange={(value) => setDraft({ q, value, edited: true })}
          onSubmit={submitSearch}
          onClear={() => submitSearch("")}
          label="Search suppliers"
          placeholder="Search suppliers"
        />
        {hasFilters && (
          <div className="grid-filter-bar">
            <span>{pagination.total_items} supplier{pagination.total_items === 1 ? "" : "s"}{q && <> for “{q}”</>}{category && <> in <strong>{category}</strong></>}</span>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        )}
      </div>

      {error && (
        <div className="grid-empty">
          <p role="alert">Could not load suppliers.</p>
          <button type="button" className="link-button" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <SupplierCardGridSkeleton gridClassName="content-grid" />
      ) : suppliers.length === 0 ? (
        error ? null : <div className="grid-empty">
          <p>{hasFilters ? "No suppliers match these filters." : "No suppliers are available yet."}</p>
        </div>
      ) : (
        <section className="content-grid" aria-label="Supplier results">
          {suppliers.map((supplier) => (
            <Link to={`/suppliers/${supplier.business_id}`} className="supplier-box" key={supplier.business_id}>
              <SupplierImage businessId={supplier.business_id} businessName={supplier.business_name} />
              <div className="supplier-box-info">
                <h3><span className="supplier-box-name" title={supplier.business_name}>{supplier.business_name}</span>{supplier.is_verified && <BadgeCheck size={16} className="verified-badge" aria-label="Verified" />}</h3>
                <p className="supplier-box-meta"><MapPin size={14} /> {supplier.city_municipality ?? supplier.city ?? "-"}</p>
                <p className="supplier-box-meta"><Package size={14} /> {supplier.product_count} product{supplier.product_count === 1 ? "" : "s"}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
      <PaginationControls pagination={pagination} onPageChange={setPage} onLimitChange={setLimit} disabled={fetching} ariaLabel="Supplier results pagination" className="supplier-results__pagination" />
    </section>
  );
}

export default SupplierGrid;
