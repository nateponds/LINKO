import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Filter, Pencil, Plus, Search, X } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";
import { peso } from "../lib/format";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PaginationControls from "../components/ui/PaginationControls";
import { readListUrlState, updateListUrlState } from "../lib/pagination";
import { apiPath, normalizePage, shouldClampPage } from "../features/suppliers/marketplacePagination";
import { TableSkeleton } from "../components/ui/pageSkeletons";
import ExpandableTableRow from "../components/ui/ExpandableTableRow";
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
  const { isAdmin, activeBusinessId, activeRoles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { page, limit, q } = readListUrlState(searchParams);

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
  const [stockError, setStockError] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const filterWrapRef = useRef(null);

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

  const loadLowStock = useCallback(async () => {
    if (!ownBusinessId) {
      setLowStockItems([]);
      setLowStockTotal(0);
      return;
    }
    try {
      const [low, out] = await Promise.all([
        apiGet(apiPath("/api/products", {
          business_id: ownBusinessId,
          stock_status: "low_stock",
          limit: 50,
        })),
        apiGet(apiPath("/api/products", {
          business_id: ownBusinessId,
          stock_status: "out_of_stock",
          limit: 50,
        })),
      ]);
      const lowPage = normalizePage(low);
      const outPage = normalizePage(out);
      const items = [...outPage.items, ...lowPage.items].sort((a, b) => {
        const byQty = Number(a.stock_quantity) - Number(b.stock_quantity);
        if (byQty !== 0) return byQty;
        return String(a.product_name).localeCompare(String(b.product_name));
      });
      setLowStockItems(items);
      setLowStockTotal(
        Number(lowPage.pagination.total_items) + Number(outPage.pagination.total_items),
      );
    } catch {
      setLowStockItems([]);
      setLowStockTotal(0);
    }
  }, [ownBusinessId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        await Promise.all([loadProducts(), loadLowStock()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadLowStock, loadProducts]);

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
      await Promise.all([loadProducts(), loadLowStock()]);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(item) {
    setConfirm({
      title: "Delete product?",
      message: `Delete ${item.product_name}${item.sku ? ` (SKU ${item.sku})` : ""} from your products? This cannot be undone.`,
      confirmLabel: "Delete product",
      onConfirm: () => { void handleDelete(item); },
    });
  }

  async function handleDelete(item) {
    try {
      await apiSend(`/api/products/${item.product_id}`, { method: "DELETE" });
      await Promise.all([loadProducts(), loadLowStock()]);
    } catch (err) {
      setError(err.message);
    }
  }

  /* ===== stock inline-edit popover ===== */
  function openStockEditor(item, anchor, focus = "exact") {
    setStockError(null);
    setStockPopover({
      rowId: item.product_id,
      productName: item.product_name,
      current: Number(item.stock_quantity) || 0,
      exact: String(item.stock_quantity ?? 0),
      received: "",
      focus,
      top: anchor?.top,
      left: anchor?.left,
    });
  }

  function handleStockEditClick(e, item) {
    const isOpen = stockPopover && stockPopover.rowId === item.product_id;
    if (isOpen) {
      setStockPopover(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    openStockEditor(item, {
      top: window.scrollY + rect.bottom + 6,
      left: window.scrollX + rect.left - 160,
    });
  }

  function parseWholeQuantity(value) {
    const text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;
    const quantity = Number(text);
    return Number.isSafeInteger(quantity) ? quantity : null;
  }

  async function patchStock(newStock) {
    if (!stockPopover) return;
    const rowId = stockPopover.rowId;
    setStockError(null);
    try {
      await apiSend(`/api/products/${rowId}`, {
        method: "PATCH",
        body: { stock_quantity: newStock },
      });
      setStockPopover(null);
      await Promise.all([loadProducts(), loadLowStock()]);
    } catch (err) {
      setStockError(err.message);
    }
  }

  function saveExactStock() {
    const newStock = parseWholeQuantity(stockPopover?.exact);
    if (newStock === null) {
      setStockError("Enter a whole quantity of 0 or more.");
      return;
    }
    void patchStock(newStock);
  }

  function addReceivedStock() {
    const received = parseWholeQuantity(stockPopover?.received);
    if (received === null || received <= 0) {
      setStockError("Enter a received quantity greater than 0.");
      return;
    }
    void patchStock(stockPopover.current + received);
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

  function submitSearch(event) {
    event.preventDefault();
    const nextQuery = new FormData(event.currentTarget).get("q");
    setSearchTerm(String(nextQuery ?? ""));
    setSearchParams(updateListUrlState(searchParams, { q: nextQuery }));
  }

  return (
    <AppLayout>
      <div className="inventory-page">
        <div className="page-head">
          <h1>My Products</h1>
          <div className="header-toolbar">
            <form className="search-bar" role="search" aria-label="Search inventory" onSubmit={submitSearch}>
              <input
                name="q"
                type="text"
                aria-label="Search inventory"
                placeholder="Search products"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="search-icon-btn" aria-label="Search inventory">
                <Search size={16} />
              </button>
            </form>

            <div
              className="filter-wrap"
              ref={filterWrapRef}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !filterPanelOpen) return;
                event.stopPropagation();
                setFilterPanelOpen(false);
                filterWrapRef.current?.querySelector(".filter-btn")?.focus();
              }}
            >
              <button type="button" className="filter-btn" aria-label="Inventory filters" aria-expanded={filterPanelOpen} aria-controls="inventory-filters" onClick={handleFilterBtnClick}>
                <Filter size={15} className="filter-btn-icon" />
                <span className="filter-btn-label">Filters{Object.values(activeFilters).some(Boolean) ? " active" : ""}</span>
                <ChevronDown size={15} className="filter-btn-chevron" />
              </button>
              <div
                id="inventory-filters"
                className={`filter-panel${filterPanelOpen ? " open" : ""}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="filter-group">
                  <h4>Category</h4>
                  <select
                    aria-label="Category"
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
                      aria-label="Minimum price"
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
                      aria-label="Maximum price"
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
                    aria-label="Stock status"
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
              <button type="button" className="add-btn" aria-label="Add product" onClick={openAddModal}>
                <Plus size={16} />
                <span className="add-btn-label">Add product</span>
              </button>
            )}
          </div>
        </div>

        {ownBusinessId && lowStockTotal > 0 && (
          <div className="low-stock-banner" role="status">
            <p>
              <strong>
                Low stock: {lowStockTotal} product{lowStockTotal === 1 ? "" : "s"}
              </strong>
            </p>
            <ul className="low-stock-list" id="inventory-low-stock">
              {lowStockItems.map((item, index) => (
                <li key={item.product_id} hidden={!showAllLowStock && index >= 3}>
                  <button
                    type="button"
                    onClick={() => openStockEditor(item, null, "received")}
                  >
                    {item.product_name}
                    <span>{item.stock_quantity}</span>
                  </button>
                </li>
              ))}
            </ul>
            {lowStockItems.length > 3 && (
              <button
                type="button"
                className="link-button"
                aria-expanded={showAllLowStock}
                aria-controls="inventory-low-stock"
                onClick={() => setShowAllLowStock((open) => !open)}
              >
                {showAllLowStock ? "Show fewer" : `Show all ${lowStockItems.length} listed`}
              </button>
            )}
            {lowStockTotal > lowStockItems.length && (
              <p className="low-stock-more">
                {lowStockTotal - lowStockItems.length} more are not listed here. Search to restock them.
              </p>
            )}
          </div>
        )}

        <section className="inventory-container" aria-label="Product results" aria-busy={loading || fetching}>
          <div>
              {loading && products.length === 0 ? (
                <TableSkeleton columns={4} rows={8} label="Loading products" className="inventory-table" />
              ) : error ? (
                <div className="grid-empty" role="alert">
                  <strong>Could not load products.</strong>{" "}
                  <button type="button" className="link-button" onClick={() => {
                    setLoading(true);
                    loadProducts();
                  }}>Try again</button>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="grid-empty"><p>{q || Object.values(activeFilters).some(Boolean) ? "No products match these filters." : "No products yet."}</p>{(q || Object.values(activeFilters).some(Boolean)) && <button type="button" className="link-button" onClick={clearFilters}>Clear filters</button>}</div>
              ) : (
                <div className="inventory-table-wrap">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="inventory-number">Unit price</th>
                      <th scope="col" className="inventory-number stock-heading">On hand</th>
                      <th scope="col" className="table-status">Status</th>

                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((item) => {
                      const status = statusFor(item.stock_status);
                      // Only the owner edits; platform_admin may only take a product down.
                      const canManage = item.business_id === ownBusinessId;
                      return (
                        <ExpandableTableRow
                          key={item.product_id}
                          label={item.product_name}
                          cells={[
                            { key: "product", className: "inventory-product", content: <>{item.product_name}{item.sku && <small>{item.sku}</small>}</> },
                            { key: "price", className: "inventory-number", content: peso(item.unit_price) },
                            {
                              key: "stock",
                              className: "stock-cell inventory-number",
                              content: (
                                <span className="stock-value">
                                  {item.stock_quantity}
                                  {canManage && (
                                    <button
                                      type="button"
                                      className="stock-edit-btn"
                                      aria-label={`Update stock for ${item.product_name}`}
                                      onClick={(event) => handleStockEditClick(event, item)}
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  )}
                                </span>
                              ),
                            },
                            { key: "status", content: <span className={`status ${status.cls}`}>{status.label}</span> },
                          ]}
                        >
                          {(canManage || isAdmin) && (
                            <div className="row-panel-actions">
                              {canManage && <button type="button" className="link-button" onClick={() => openEditModal(item)}>Edit product</button>}
                              <button type="button" className="link-button inventory-delete" onClick={() => requestDelete(item)}>Delete product</button>
                            </div>
                          )}
                        </ExpandableTableRow>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
          </div>
          <PaginationControls pagination={pagination} disabled={fetching} onPageChange={(nextPage) => setSearchParams(updateListUrlState(searchParams, { page: nextPage }))} onLimitChange={(nextLimit) => setSearchParams(updateListUrlState(searchParams, { limit: nextLimit }))} ariaLabel="Inventory pagination" />
        </section>

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
            className={`stock-popover open${stockPopover.top == null ? " centered" : ""}`}
            style={
              stockPopover.top == null
                ? undefined
                : { top: stockPopover.top, left: stockPopover.left }
            }
          >
            <p className="stock-popover-title">
              {stockPopover.productName}
              <span>On hand: {stockPopover.current}</span>
            </p>
            <label>
              Exact quantity
              <input
                type="number"
                min="0"
                step="1"
                value={stockPopover.exact}
                autoFocus={stockPopover.focus === "exact"}
                onChange={(e) =>
                  setStockPopover((p) => ({ ...p, exact: e.target.value }))
                }
              />
            </label>
            <div className="stock-popover-actions">
              <button type="button" className="btn-primary" onClick={saveExactStock}>
                Set quantity
              </button>
            </div>
            <label>
              Received quantity
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Add to on hand"
                value={stockPopover.received}
                autoFocus={stockPopover.focus === "received"}
                onChange={(e) =>
                  setStockPopover((p) => ({ ...p, received: e.target.value }))
                }
              />
            </label>
            {stockError && <p className="stock-popover-error">{stockError}</p>}
            <div className="stock-popover-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStockPopover(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={addReceivedStock}>
                Add received
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AppLayout>
  );
}
