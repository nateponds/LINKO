import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Filter, Pencil, Plus, Search, X } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";
import { peso } from "../lib/format";
import PaginationControls from "../components/ui/PaginationControls";
import { readListUrlState, updateListUrlState } from "../lib/pagination";
import { apiPath, normalizePage, shouldClampPage } from "../features/suppliers/marketplacePagination";
import "./InventoryPage.css";

const EMPTY_FORM = {
  sku: "",
  name: "",
  price: "",
  category_id: "",
  stock: "",
  image_url: "",
  description: "",
};
const EMPTY_FILTERS = { category: "", priceMin: "", priceMax: "", stock: "" };

function statusFor(status) {
  if (status === "out_of_stock")
    return { label: "Out of Stock", cls: "out-of-stock" };
  if (status === "low_stock")
    return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}

export default function InventoryPage() {
  const { user, activeBusinessId, activeRoles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, q } = readListUrlState(searchParams);

  const isAdmin = user?.global_role === "platform_admin";
  const ownBusinessId = activeRoles.includes("wholesaler")
    ? activeBusinessId
    : null;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [pagination, setPagination] = useState({ page, limit, total_items: 0, total_pages: 0 });
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState(q);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const activeFilters = useMemo(() => ({
    category: searchParams.get("category") ?? "",
    priceMin: searchParams.get("priceMin") ?? "",
    priceMax: searchParams.get("priceMax") ?? "",
    stock: searchParams.get("stock") ?? "",
  }), [searchParams]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [stockPopover, setStockPopover] = useState(null);

  const filterWrapRef = useRef(null);
  const tableContentRef = useRef(null);
  const [tableHeight, setTableHeight] = useState("auto");

  useEffect(() => {
    if (!tableContentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setTableHeight(entries[0].target.offsetHeight);
    });
    observer.observe(tableContentRef.current);
    return () => observer.disconnect();
  }, []);

  const loadProducts = useCallback(async () => {
    const path = apiPath("/api/products", {
      business_id: isAdmin || !ownBusinessId ? undefined : ownBusinessId,
      q, page, limit,
      category_id: activeFilters.category,
      min_price: activeFilters.priceMin,
      max_price: activeFilters.priceMax,
      stock_status: activeFilters.stock === "in" ? "in_stock" : activeFilters.stock === "low" ? "low_stock" : activeFilters.stock === "out" ? "out_of_stock" : undefined,
    });
    try {
      if (products.length) setFetching(true);
      const data = await apiGet(path);
      const next = normalizePage(data);
      if (shouldClampPage(next.pagination)) {
        setSearchParams(updateListUrlState(searchParams, { page: next.pagination.total_pages }), { replace: true });
        return;
      }
      setProducts(next.items);
      setPagination(next.pagination);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally { setFetching(false); }
  }, [activeFilters, isAdmin, limit, ownBusinessId, page, products.length, q, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        await loadProducts();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchTerm !== q) setSearchParams(updateListUrlState(searchParams, { q: searchTerm }), { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, searchParams, searchTerm, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    apiGet("/api/categories/options")
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ===== close filter panel on outside click ===== */
  useEffect(() => {
    if (!filterPanelOpen) return;
    function handleDocClick() {
      setFilterPanelOpen(false);
    }
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [filterPanelOpen]);

  const visibleProducts = products;

  /* ===== add/edit item modal ===== */
  function openAddModal() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingId(item.product_id);
    setFormData({
      sku: item.sku ?? "",
      name: item.product_name ?? "",
      price: item.unit_price ?? "",
      category_id: item.category_id != null ? String(item.category_id) : "",
      stock: item.stock_quantity ?? "",
      image_url: item.image_url ?? "",
      description: item.description ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const body = {
      product_name: formData.name.trim(),
      unit_price: parseFloat(formData.price) || 0,
      sku: formData.sku.trim() || undefined,
      category_id: formData.category_id
        ? Number(formData.category_id)
        : undefined,
      stock_quantity:
        formData.stock === "" ? 0 : parseInt(formData.stock, 10) || 0,
      image_url: formData.image_url.trim() || undefined,
      description: formData.description.trim() || undefined,
    };

    try {
      if (editingId) {
        await apiSend(`/api/products/${editingId}`, { method: "PATCH", body });
      } else {
        await apiSend("/api/products", { method: "POST", body });
      }
      closeModal();
      await loadProducts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.product_name}"?`)) return;
    try {
      await apiSend(`/api/products/${item.product_id}`, { method: "DELETE" });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  /* ===== stock inline-edit popover ===== */
  function handleStockEditClick(e, item) {
    const isOpen = stockPopover && stockPopover.rowId === item.product_id;
    if (isOpen) {
      setStockPopover(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setStockPopover({
      rowId: item.product_id,
      top: window.scrollY + rect.bottom + 6,
      left: window.scrollX + rect.left - 160,
      value: item.stock_quantity,
    });
  }

  async function saveStockEdit() {
    if (!stockPopover) return;
    const newStock = parseInt(stockPopover.value, 10) || 0;
    const rowId = stockPopover.rowId;
    setStockPopover(null);
    try {
      await apiSend(`/api/products/${rowId}`, {
        method: "PATCH",
        body: { stock_quantity: newStock },
      });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  /* ===== filter panel ===== */
  function handleFilterBtnClick(e) {
    e.stopPropagation();
    setFilterPanelOpen((v) => !v);
  }

  function applyFilters() {
    setSearchParams(updateListUrlState(searchParams, { filters: draftFilters }));
    setFilterPanelOpen(false);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setSearchParams(updateListUrlState(searchParams, { filters: EMPTY_FILTERS }));
  }

  return (
    <AppLayout>
      <div className="inventory-page">
        <div className="page-head">
          <h1>My Products</h1>
          <div className="header-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-icon-btn" aria-label="Search">
                <Search size={16} />
              </button>
            </div>

            <div className="filter-wrap" ref={filterWrapRef}>
              <button className="filter-btn" onClick={handleFilterBtnClick}>
                <Filter size={15} className="filter-btn-icon" />
                <span className="filter-btn-label">Filter</span>
                <ChevronDown size={15} className="filter-btn-chevron" />
              </button>
              <div
                className={`filter-panel${filterPanelOpen ? " open" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="filter-group">
                  <h4>Category</h4>
                  <select
                    value={draftFilters.category}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        category: e.target.value,
                      }))
                    }
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <h4>Price (₱)</h4>
                  <div className="filter-range">
                    <input
                      type="number"
                      placeholder="Min"
                      min="0"
                      value={draftFilters.priceMin}
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          priceMin: e.target.value,
                        }))
                      }
                    />
                    <span>–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={draftFilters.priceMax}
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          priceMax: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="filter-group">
                  <h4>Stock</h4>
                  <select
                    value={draftFilters.stock}
                    onChange={(e) =>
                      setDraftFilters((f) => ({ ...f, stock: e.target.value }))
                    }
                  >
                    <option value="">All</option>
                    <option value="in">In Stock</option>
                    <option value="low">Low on Stock</option>
                    <option value="out">Out of Stock</option>
                  </select>
                </div>
                <div className="filter-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={applyFilters}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {ownBusinessId && (
              <button className="add-btn" onClick={openAddModal}>
                <Plus size={16} />
                <span className="add-btn-label">Add Item</span>
              </button>
            )}
          </div>
        </div>

        <main className="inventory-container" aria-busy={fetching}>
          <div
            className="table-height-animator"
            style={{
              height: tableHeight === "auto" ? "auto" : `${tableHeight}px`,
              overflow: "hidden",
              transition: "height 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            <div ref={tableContentRef}>
              {loading && products.length === 0 ? (
                <p className="grid-empty">Loading products…</p>
              ) : error ? (
                <p className="grid-empty">
                  Could not load products: {error}
                </p>
              ) : visibleProducts.length === 0 ? (
                <div className="grid-empty"><p>{q || Object.values(activeFilters).some(Boolean) ? "No products match these filters." : "No products yet."}</p>{(q || Object.values(activeFilters).some(Boolean)) && <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button>}</div>
              ) : (
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th className="col-sku">SKU</th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th className="col-status">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((item) => {
                      const status = statusFor(item.stock_status);
                      const canManage =
                        isAdmin || item.business_id === ownBusinessId;
                      return (
                        <tr key={item.product_id}>
                          <td className="col-sku">{item.sku ?? "—"}</td>
                          <td>
                            <strong>{item.product_name}</strong>
                          </td>
                          <td>{peso(item.unit_price)}</td>
                          <td className="stock-cell">
                            <span className="stock-value">
                              {item.stock_quantity}
                              {canManage && (
                                <button
                                  type="button"
                                  className="stock-edit-btn"
                                  title="Edit stock"
                                  onClick={(e) => handleStockEditClick(e, item)}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </span>
                          </td>
                          <td className="col-status">
                            <span className={`status ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                          <td>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  className="stock-edit-btn"
                                  title="Edit item"
                                  onClick={() => openEditModal(item)}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="stock-edit-btn"
                                  title="Delete item"
                                  onClick={() => handleDelete(item)}
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <PaginationControls pagination={pagination} disabled={fetching} onPageChange={(nextPage) => setSearchParams(updateListUrlState(searchParams, { page: nextPage }))} onLimitChange={(nextLimit) => setSearchParams(updateListUrlState(searchParams, { limit: nextLimit }))} ariaLabel="Inventory pagination" />
        </main>

        {/* ===== Add/Edit item modal ===== */}
        <div className={`modal-overlay${modalOpen ? " open" : ""}`}>
          <div className="modal-box">
            <button className="modal-close" onClick={closeModal}>
              <X size={18} />
            </button>
            <h2>{editingId ? "Edit Item" : "Add Item"}</h2>
            <form onSubmit={handleFormSubmit}>
              <label>
                SKU (optional)
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => handleFormChange("sku", e.target.value)}
                />
              </label>

              <label>
                Name
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </label>

              <label>
                Price (₱)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => handleFormChange("price", e.target.value)}
                />
              </label>

              <label>
                Category
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    handleFormChange("category_id", e.target.value)
                  }
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.stock}
                  onChange={(e) => handleFormChange("stock", e.target.value)}
                />
              </label>

              <label>
                Image URL (optional)
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) =>
                    handleFormChange("image_url", e.target.value)
                  }
                />
              </label>

              <label>
                Description (optional)
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) =>
                    handleFormChange("description", e.target.value)
                  }
                />
              </label>

              {formError && <p className="grid-empty">{formError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ===== Stock inline-edit popover ===== */}
        {stockPopover && (
          <div
            className="stock-popover open"
            style={{ top: stockPopover.top, left: stockPopover.left }}
          >
            <label>
              Stock
              <input
                type="number"
                min="0"
                step="1"
                value={stockPopover.value}
                onChange={(e) =>
                  setStockPopover((p) => ({ ...p, value: e.target.value }))
                }
              />
            </label>
            <div className="stock-popover-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStockPopover(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveStockEdit}
              >
                Update
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
