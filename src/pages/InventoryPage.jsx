import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Pencil, Plus, Search, X } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import "./InventoryPage.css";

const CATEGORIES = [
  "Beverages",
  "Snacks",
  "Dairy",
  "Bakery",
  "Frozen Foods",
  "Household",
  "Personal Care",
  "General",
];

const INITIAL_INVENTORY = [
  { id: "A2G51", sku: "A2G51", name: "Something Product Name", price: 200, category: "General", stock: 100, notes: "" },
  { id: "AF41W", sku: "AF41W", name: "Something Product Name", price: 200, category: "General", stock: 0, notes: "" },
];

const EMPTY_FORM = { sku: "", name: "", price: "", category: "", stock: "", notes: "" };
const EMPTY_FILTERS = { category: "", priceMin: "", priceMax: "", stock: "" };

function statusFor(stock) {
  if (stock <= 0) return { label: "Out of Stock", cls: "out-of-stock" };
  if (stock <= 10) return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [searchTerm, setSearchTerm] = useState("");

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS); // controls the panel's inputs
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS); // filters actually applied

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = "Add Item" mode
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [checkedRowId, setCheckedRowId] = useState(null);

  const [stockPopover, setStockPopover] = useState(null); // { rowId, top, left, value } | null

  const filterWrapRef = useRef(null);

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
  const visibleInventory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const priceMin = activeFilters.priceMin === "" ? null : parseFloat(activeFilters.priceMin);
    const priceMax = activeFilters.priceMax === "" ? null : parseFloat(activeFilters.priceMax);

    return inventory.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (activeFilters.category && item.category !== activeFilters.category) return false;
      if (priceMin !== null && item.price < priceMin) return false;
      if (priceMax !== null && item.price > priceMax) return false;

      if (activeFilters.stock) {
        const s = statusFor(item.stock);
        if (activeFilters.stock === "in" && s.cls !== "in-stock") return false;
        if (activeFilters.stock === "low" && s.cls !== "low-on-stock") return false;
        if (activeFilters.stock === "out" && s.cls !== "out-of-stock") return false;
      }
      return true;
    });
  }, [inventory, searchTerm, activeFilters]);

  /* ===== add/edit item modal ===== */
  function openAddModal() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditingId(item.id);
    setFormData({
      sku: item.sku,
      name: item.name,
      price: item.price,
      category: item.category,
      stock: item.stock,
      notes: item.notes,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setCheckedRowId(null);
  }

  function handleFormChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const sku = formData.sku.trim();
    const newItem = {
      id: editingId || sku,
      sku,
      name: formData.name.trim(),
      price: parseFloat(formData.price) || 0,
      category: formData.category.trim(),
      stock: parseInt(formData.stock, 10) || 0,
      notes: formData.notes.trim(),
    };

    setInventory((prev) => {
      if (editingId) {
        return prev.map((i) => (i.id === editingId ? newItem : i));
      }
      return [...prev, newItem];
    });

    closeModal();
  }

  /* ===== row checkbox → opens edit modal ===== */
  function handleRowCheckboxChange(item, checked) {
    if (!checked) return;
    setCheckedRowId(item.id);
    openEditModal(item);
  }

  /* ===== stock inline-edit popover ===== */
  function handleStockEditClick(e, item) {
    const isOpen = stockPopover && stockPopover.rowId === item.id;
    if (isOpen) {
      setStockPopover(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setStockPopover({
      rowId: item.id,
      top: window.scrollY + rect.bottom + 6,
      left: window.scrollX + rect.left - 160,
      value: item.stock,
    });
  }

  function saveStockEdit() {
    if (!stockPopover) return;
    const newStock = parseInt(stockPopover.value, 10) || 0;
    setInventory((prev) =>
      prev.map((i) => (i.id === stockPopover.rowId ? { ...i, stock: newStock } : i))
    );
    setStockPopover(null);
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
          <h1>Inventory</h1>
          <div className="header-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-icon-btn" aria-label="Search"><Search size={16} /></button>
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
                      setDraftFilters((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
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
                        setDraftFilters((f) => ({ ...f, priceMin: e.target.value }))
                      }
                    />
                    <span>–</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="0"
                      value={draftFilters.priceMax}
                      onChange={(e) =>
                        setDraftFilters((f) => ({ ...f, priceMax: e.target.value }))
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
                  <button type="button" className="btn-secondary" onClick={clearFilters}>
                    Clear
                  </button>
                  <button type="button" className="btn-primary" onClick={applyFilters}>
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <button className="add-btn" onClick={openAddModal}>ADD ITEMS <Plus size={16} /></button>
          </div>
        </div>

      <main className="inventory-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th></th>
              <th>ID Number / SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleInventory.map((item) => {
              const status = statusFor(item.stock);
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="row-select"
                      checked={checkedRowId === item.id}
                      onChange={(e) => handleRowCheckboxChange(item, e.target.checked)}
                    />
                  </td>
                  <td>{item.sku}</td>
                  <td><strong>{item.name}</strong></td>
                  <td>₱{Number(item.price).toFixed(2)}</td>
                  <td className="stock-cell">
                    <span className="stock-value">{item.stock}</span>
                    <button
                      type="button"
                      className="stock-edit-btn"
                      title="Edit stock"
                      onClick={(e) => handleStockEditClick(e, item)}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                  <td><span className={`status ${status.cls}`}>{status.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      {/* ===== Add/Edit item modal ===== */}
      <div className={`modal-overlay${modalOpen ? " open" : ""}`}>
        <div className="modal-box">
          <button className="modal-close" onClick={closeModal}><X size={18} /></button>
          <h2>{editingId ? "Edit Item" : "Add Item"}</h2>
          <form onSubmit={handleFormSubmit}>
            <label>
              ID Number / SKU
              <input
                type="text"
                required
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
                required
                value={formData.category}
                onChange={(e) => handleFormChange("category", e.target.value)}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label>
              Stock
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.stock}
                onChange={(e) => handleFormChange("stock", e.target.value)}
              />
            </label>

            <label>
              Notes (optional)
              <textarea
                rows="3"
                value={formData.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">Save Item</button>
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
            <button type="button" className="btn-secondary" onClick={() => setStockPopover(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveStockEdit}>
              Update
            </button>
          </div>
        </div>
      )}

      </div>
    </AppLayout>
  );
}
