import { useState, useEffect, useCallback } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { apiGet, apiSend } from "../../lib/api";

/* Sprint 10 stock tab: warehouse-level inventory_items rows from
   GET /api/inventory, with add (POST) and adjust (PATCH) forms per
   docs/API_CONTRACTS.md sections 1.2-1.4. Products for the add form's picker
   come from the parent page, which already loads them. */

const EMPTY_ADD = { product_id: "", warehouse_id: "", quantity: "", unit: "pcs", reorder_threshold: "10" };

function statusClass(status) {
  if (status === "Out of Stock") return "out-of-stock";
  if (status === "Low Stock") return "low-on-stock";
  return "in-stock";
}

export default function StockTab({ products }) {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // modal: { mode: "add" } | { mode: "adjust", item }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_ADD);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await apiGet("/api/inventory");
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await Promise.all([
          loadItems(),
          apiGet("/api/warehouses")
            .then((data) => {
              if (!cancelled) setWarehouses(Array.isArray(data) ? data : []);
            })
            .catch(() => {
              if (!cancelled) setWarehouses([]);
            }),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadItems]);

  function openAdd() {
    setForm({ ...EMPTY_ADD, warehouse_id: warehouses[0] ? String(warehouses[0].warehouse_id) : "" });
    setFormError(null);
    setModal({ mode: "add" });
  }

  function openAdjust(item) {
    setForm({
      quantity: String(item.quantity),
      unit: item.unit,
      reorder_threshold: String(item.reorder_threshold),
    });
    setFormError(null);
    setModal({ mode: "adjust", item });
  }

  function change(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await apiSend("/api/inventory", {
          method: "POST",
          body: {
            product_id: Number(form.product_id),
            warehouse_id: Number(form.warehouse_id),
            quantity: parseInt(form.quantity, 10) || 0,
            unit: form.unit.trim() || "pcs",
            reorder_threshold: parseInt(form.reorder_threshold, 10) || 0,
          },
        });
      } else {
        await apiSend(`/api/inventory/${modal.item.item_id}`, {
          method: "PATCH",
          body: {
            quantity: parseInt(form.quantity, 10) || 0,
            unit: form.unit.trim() || "pcs",
            reorder_threshold: parseInt(form.reorder_threshold, 10) || 0,
          },
        });
      }
      setModal(null);
      await loadItems();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="stock-toolbar">
        <button className="add-btn" onClick={openAdd} disabled={!warehouses.length}>
          ADD STOCK <Plus size={16} />
        </button>
      </div>

      {loading ? (
        <p className="grid-empty">Loading stock…</p>
      ) : error ? (
        <p className="grid-empty">Could not load stock: {error}</p>
      ) : items.length === 0 ? (
        <p className="grid-empty">No stock recorded yet.</p>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th>Reorder at</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.item_id}>
                <td>
                  <strong>{item.product.product_name}</strong>
                </td>
                <td>{item.product.sku ?? "—"}</td>
                <td>
                  {item.warehouse.warehouse_name}
                  <span className="stock-warehouse-city"> · {item.warehouse.city}</span>
                </td>
                <td>
                  {item.quantity} {item.unit}
                </td>
                <td>{item.reorder_threshold}</td>
                <td>
                  <span className={`status ${statusClass(item.status)}`}>{item.status}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="stock-edit-btn"
                    title="Adjust stock"
                    onClick={() => openAdjust(item)}
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===== Add / adjust stock modal ===== */}
      <div className={`modal-overlay${modal ? " open" : ""}`}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setModal(null)}>
            <X size={18} />
          </button>
          <h2>{modal?.mode === "adjust" ? "Adjust Stock" : "Add Stock"}</h2>
          {modal && (
            <form onSubmit={handleSubmit}>
              {modal.mode === "add" && (
                <>
                  <label>
                    Product
                    <select
                      required
                      value={form.product_id}
                      onChange={(e) => change("product_id", e.target.value)}
                    >
                      <option value="">Select a product</option>
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Warehouse
                    <select
                      required
                      value={form.warehouse_id}
                      onChange={(e) => change("warehouse_id", e.target.value)}
                    >
                      {warehouses.map((w) => (
                        <option key={w.warehouse_id} value={w.warehouse_id}>
                          {w.warehouse_name} ({w.city})
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {modal.mode === "adjust" && (
                <p className="stock-adjust-target">
                  {modal.item.product.product_name} — {modal.item.warehouse.warehouse_name}
                </p>
              )}

              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.quantity}
                  onChange={(e) => change("quantity", e.target.value)}
                />
              </label>

              <label>
                Unit
                <input
                  type="text"
                  maxLength="20"
                  value={form.unit}
                  onChange={(e) => change("unit", e.target.value)}
                />
              </label>

              <label>
                Reorder threshold
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.reorder_threshold}
                  onChange={(e) => change("reorder_threshold", e.target.value)}
                />
              </label>

              {formError && <p className="grid-empty">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving…" : modal.mode === "adjust" ? "Update Stock" : "Add Stock"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
