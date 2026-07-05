import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ChevronDown, Pencil, Plus, Search, X } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";
import { peso } from "../lib/format";
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
  const { user, memberships } = useAuth();

  const isAdmin = user?.global_role === "platform_admin";
  const wholesalerMembership = useMemo(
    () => memberships.find((m) => m.role === "wholesaler") ?? null,
    [memberships],
  );
  const ownBusinessId = wholesalerMembership?.business_id ?? null;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [stockPopover, setStockPopover] = useState(null);

  const filterWrapRef = useRef(null);

  const loadProducts = useCallback(async () => {
    const path =
      isAdmin || !ownBusinessId
        ? "/api/products"
        : `/api/products?business_id=${encodeURIComponent(ownBusinessId)}`;
    try {
      const data = await apiGet(path);
      setProducts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [isAdmin, ownBusinessId]);

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
    let cancelled = false;
    apiGet("/api/categories")
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

  /* ===== derived: filtered + searched rows ===== */
  const visibleProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const priceMin =
      activeFilters.priceMin === "" ? null : parseFloat(activeFilters.priceMin);
    const priceMax =
      activeFilters.priceMax === "" ? null : parseFloat(activeFilters.priceMax);

    return products.filter((item) => {
      const price = Number(item.unit_price);
      const matchesSearch =
        !term ||
        item.product_name.toLowerCase().includes(term) ||
        (item.sku || "").toLowerCase().includes(term) ||
        (item.category_name || "").toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (
        activeFilters.category &&
        String(item.category_id) !== String(activeFilters.category)
      )
        return false;
      if (priceMin !== null && price < priceMin) return false;
      if (priceMax !== null && price > priceMax) return false;

      if (activeFilters.stock) {
        const s = statusFor(item.stock_status);
        if (activeFilters.stock === "in" && s.cls !== "in-stock") return false;
        if (activeFilters.stock === "low" && s.cls !== "low-on-stock")
          return false;
        if (activeFilters.stock === "out" && s.cls !== "out-of-stock")
          return false;
      }
      return true;
    });
  }, [products, searchTerm, activeFilters]);

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
    setActiveFilters(draftFilters);
    setFilterPanelOpen(false);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setActiveFilters(EMPTY_FILTERS);
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
                FILTER <ChevronDown size={14} />
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
                ADD ITEMS <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <main className="inventory-container">
          {loading ? (
            <p className="grid-empty">Loading products…</p>
          ) : error ? (
            <p className="grid-empty">
              Could not load products: {error}. Backend is not running bruh
            </p>
          ) : visibleProducts.length === 0 ? (
            <p className="grid-empty">No products yet.</p>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
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
                      <td>{item.sku ?? "—"}</td>
                      <td>
                        <strong>{item.product_name}</strong>
                      </td>
                      <td>{peso(item.unit_price)}</td>
                      <td className="stock-cell">
                        <span className="stock-value">
                          {item.stock_quantity}
                        </span>
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
                      </td>
                      <td>
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
