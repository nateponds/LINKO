import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { apiPath, normalizePage } from "../suppliers/marketplacePagination";
import {
  clearRecentSearches,
  loadRecentSearches,
  marketplaceSearchPath,
  normalizeSearchQuery,
  rankSuggestions,
  rememberSearch,
  saveRecentSearches,
} from "./marketplaceSearch.js";

const PRODUCT_FIELDS = ["product_name", "sku", "category_name"];
const SUPPLIER_FIELDS = ["business_name", "city_municipality", "province", "city"];
const NO_SUGGESTIONS = [];

function MarketplaceSearch({ categories = [] }) {
  const listId = useId();
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const categoryName = searchParams.get("category") ?? "";
  const categoryId = categories.find((category) => category.category_name === categoryName)?.category_id;
  const [query, setQuery] = useState(qParam);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState(() => loadRecentSearches());
  const [suggestions, setSuggestions] = useState({ query: "", products: [], suppliers: [], error: null, loading: false });
  const debouncedQuery = useDebouncedValue(query, 300);
  const typedQuery = normalizeSearchQuery(query);
  const settledQuery = normalizeSearchQuery(debouncedQuery);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  useEffect(() => {
    if (!settledQuery) return undefined;

    const controller = new AbortController();
    async function load() {
      setSuggestions({ query: settledQuery, products: [], suppliers: [], error: null, loading: true });
      try {
        const [productPage, supplierPage] = await Promise.all([
          apiGet(apiPath("/api/products", { q: settledQuery, page: 1, limit: 10, category_id: categoryId }), { signal: controller.signal }),
          apiGet(apiPath("/api/suppliers", { q: settledQuery, page: 1, limit: 10, category_id: categoryId }), { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setSuggestions({
          query: settledQuery,
          products: rankSuggestions(normalizePage(productPage).items, settledQuery, { fields: PRODUCT_FIELDS }),
          suppliers: rankSuggestions(normalizePage(supplierPage).items, settledQuery, { fields: SUPPLIER_FIELDS }),
          error: null,
          loading: false,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setSuggestions({ query: settledQuery, products: [], suppliers: [], error: error.message, loading: false });
      }
    }
    load();
    return () => controller.abort();
  }, [categoryId, settledQuery]);

  const suggestionMatches = suggestions.query === settledQuery;
  const products = settledQuery && suggestionMatches ? suggestions.products : NO_SUGGESTIONS;
  const suppliers = settledQuery && suggestionMatches ? suggestions.suppliers : NO_SUGGESTIONS;
  const loading = Boolean(settledQuery) && (!suggestionMatches || suggestions.loading);
  const suggestError = suggestionMatches ? suggestions.error : null;
  const options = useMemo(() => {
    if (!typedQuery) {
      return recent.map((item) => ({ type: "recent", id: item.toLowerCase(), label: item, query: item }));
    }
    return [
      ...products.map((product) => ({
        type: "product",
        id: `product-${product.product_id}`,
        label: product.product_name,
        detail: [product.business_name, product.sku].filter(Boolean).join(" · "),
        href: `/suppliers/${product.business_id}?product_id=${product.product_id}`,
      })),
      ...suppliers.map((supplier) => ({
        type: "supplier",
        id: `supplier-${supplier.business_id}`,
        label: supplier.business_name,
        detail: [supplier.city_municipality ?? supplier.city, supplier.province].filter(Boolean).join(", "),
        href: `/suppliers/${supplier.business_id}`,
      })),
    ];
  }, [products, recent, suppliers, typedQuery]);

  const pending = Boolean(typedQuery) && typedQuery !== settledQuery;
  const visibleOptions = typedQuery && (pending || loading || suggestError) ? [] : options;
  const safeIndex = activeIndex >= 0 && activeIndex < visibleOptions.length ? activeIndex : -1;
  const activeId = safeIndex >= 0 ? `${listId}-option-${safeIndex}` : undefined;
  const showPanel = open && (typedQuery || recent.length > 0);

  useEffect(() => {
    if (safeIndex < 0) return undefined;
    document.getElementById(`${listId}-option-${safeIndex}`)?.scrollIntoView({ block: "nearest" });
    return undefined;
  }, [listId, safeIndex]);

  function remember(value) {
    const next = rememberSearch(loadRecentSearches(), value);
    saveRecentSearches(next);
    setRecent(next);
  }

  function goToResults(value) {
    const nextQuery = normalizeSearchQuery(value);
    if (nextQuery) remember(nextQuery);
    setOpen(false);
    setActiveIndex(-1);
    navigate(marketplaceSearchPath({ q: nextQuery, category: categoryName }));
  }

  function activate(option) {
    if (!option) {
      goToResults(query);
      return;
    }
    if (option.type === "recent") {
      setQuery(option.query);
      goToResults(option.query);
      return;
    }
    if (typedQuery) remember(typedQuery);
    setOpen(false);
    setActiveIndex(-1);
    navigate(option.href);
  }

  function clearRecent() {
    clearRecentSearches(window.localStorage);
    setRecent([]);
    setActiveIndex(-1);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleOptions.length === 0) return;
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const count = visibleOptions.length;
      setActiveIndex((current) => {
        const index = current >= 0 && current < count ? current : -1;
        if (index === -1) return delta > 0 ? 0 : count - 1;
        return (index + delta + count) % count;
      });
      return;
    }
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter" && safeIndex >= 0) {
      event.preventDefault();
      activate(visibleOptions[safeIndex]);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (safeIndex >= 0) {
      activate(visibleOptions[safeIndex]);
      return;
    }
    goToResults(query);
  }

  let suggestionBody;
  if (!typedQuery) {
    suggestionBody = (
      <div role="group" aria-label="Recent searches">
        <div className="search-suggest__head">
          <p className="search-suggest__label">Recent searches</p>
          <button type="button" className="search-suggest__clear" onClick={clearRecent}>
            Clear
          </button>
        </div>
        {visibleOptions.map((option, index) => (
          <SuggestionOption key={option.id} listId={listId} index={index} option={option} selected={index === safeIndex} onSelect={activate} />
        ))}
      </div>
    );
  } else if (pending || loading) {
    suggestionBody = <p className="search-suggest__status" role="status">Searching…</p>;
  } else if (suggestError) {
    suggestionBody = <p className="search-suggest__status" role="status">Suggestions are unavailable. Press Enter to search.</p>;
  } else if (options.length === 0) {
    suggestionBody = <p className="search-suggest__status" role="status">No matching products or suppliers.</p>;
  } else {
    suggestionBody = (
      <>
        <SuggestionGroup label="Products" options={visibleOptions} listId={listId} selectedIndex={safeIndex} onSelect={activate} type="product" />
        <SuggestionGroup label="Suppliers" options={visibleOptions} listId={listId} selectedIndex={safeIndex} onSelect={activate} type="supplier" />
      </>
    );
  }

  return (
    <form className="search" role="search" onSubmit={submit} ref={rootRef}>
      <div className="search-field">
        <input
          type="text"
          name="q"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel ? activeId : undefined}
          aria-label="Search products and suppliers"
          placeholder="Search products and suppliers"
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setRecent(loadRecentSearches());
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="icon-btn go" title="Search">
          Search <Search size={16} />
        </button>
      </div>
      {showPanel && (
        <div className="search-suggest" id={listId} role="listbox" aria-label="Search suggestions">
          {suggestionBody}
        </div>
      )}
    </form>
  );
}

function SuggestionGroup({ label, options, listId, selectedIndex, onSelect, type }) {
  const group = options
    .map((option, index) => ({ option, index }))
    .filter((entry) => entry.option.type === type);
  if (group.length === 0) return null;
  return (
    <div role="group" aria-label={label}>
      <p className="search-suggest__label">{label}</p>
      {group.map(({ option, index }) => (
        <SuggestionOption key={option.id} listId={listId} index={index} option={option} selected={index === selectedIndex} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SuggestionOption({ listId, index, option, selected, onSelect }) {
  return (
    <div
      id={`${listId}-option-${index}`}
      role="option"
      aria-selected={selected}
      className="search-suggest__option"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(option)}
    >
      <span className="search-suggest__option-label">{option.label}</span>
      {option.detail && <span className="search-suggest__option-detail">{option.detail}</span>}
    </div>
  );
}

export default MarketplaceSearch;
