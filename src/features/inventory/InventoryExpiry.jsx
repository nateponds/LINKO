import { useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import PaginationControls from "../../components/ui/PaginationControls";
import { useDialogFocus } from "../../components/ui/useDialogFocus";
import { lockBodyScroll } from "../../lib/bodyScrollLock";
import "./InventoryExpiry.css";

const EMPTY = { batch_number: "", manufactured_on: "", received_on: "", expires_on: "", notes: "" };
const LABELS = { expired: "Expired", expiring_soon: "Expiring soon", fresh: "Fresh", depleted: "Depleted" };

export default function InventoryExpiry({ product, onClose, businessId, revision = 0, onChanged }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState("");
  const [days, setDays] = useState(30);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useDialogFocus({ open: !!product, dialogRef, initialFocusRef: closeRef, onEscape: onClose });
  useEffect(() => {
    if (product) return lockBodyScroll();
  }, [product]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page, limit, days });
    if (product) params.set("product_id", product.product_id);
    if (businessId) params.set("business_id", businessId);
    if (status) params.set("status", status);
    apiGet(`/api/inventory-batches?${params}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.pagination.total_pages > 0 && page > data.pagination.total_pages) {
          setPage(data.pagination.total_pages);
          return;
        }
        setResult(data);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [product, businessId, page, limit, status, days, version, revision]);

  function reload() {
    setLoading(true);
    setVersion((value) => value + 1);
  }

  async function mutate(path, method, body) {
    setSaving(true);
    setError("");
    try {
      await apiSend(path, { method, body });
      setEditing(null);
      setForm(EMPTY);
      reload();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function save(event) {
    event.preventDefault();
    const body = {
      ...form,
      manufactured_on: form.manufactured_on || null,
      received_on: form.received_on || undefined,
      notes: form.notes || null,
    };
    if (!editing) body.product_id = product.product_id;
    void mutate(editing ? `/api/inventory-batches/${editing}` : "/api/inventory-batches", editing ? "PATCH" : "POST", body);
  }

  function edit(batch) {
    setEditing(batch.batch_id);
    setForm(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, batch[key] ?? ""])));
  }

  const content = (
    <section className="inventory-expiry" aria-label="Inventory expiry dates">
      <div className="expiry-heading">
        <h2 id={product ? "expiry-dialog-title" : undefined}>{product ? `${product.product_name}: expiry batches` : "Inventory expiry dates"}</h2>
        {product && <button ref={closeRef} type="button" className="btn-secondary" onClick={onClose}>Close</button>}
      </div>
      <p>Track expiry dates by batch. Mark a batch depleted when none remains on hand. Stock quantities are managed separately.</p>
      <div className="expiry-filters">
        <label>Status
          <select value={status} disabled={saving} onChange={(event) => { setStatus(event.target.value); setPage(1); setLoading(true); }}>
            <option value="">All batches</option>
            {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Warning window
          <select value={days} disabled={saving} onChange={(event) => { setDays(Number(event.target.value)); setPage(1); setLoading(true); }}>
            {[7, 14, 30, 60, 90].map((value) => <option key={value} value={value}>{value} days</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error} <button type="button" className="link-button" onClick={reload}>Retry loading</button></p>}
      <div aria-busy={loading}>
        {loading ? <p role="status">Loading batches…</p> : !error && result?.items.length === 0 ? <p>No batches match this view. Use “Expiry batches” on a product to record a batch.</p> : null}
        {!loading && !error && result?.items.length > 0 && <ul className="expiry-list">
          {result.items.map((batch) => <li key={batch.batch_id}>
            <div>
              <strong>{batch.product_name} — {batch.batch_number}</strong>
              <p>Expires <time dateTime={batch.expires_on}>{batch.expires_on}</time> · <span className={`expiry-status expiry-${batch.expiry_status}`}>{LABELS[batch.expiry_status]}</span></p>
              {batch.notes && <p>{batch.notes}</p>}
            </div>
            {product && <div className="expiry-actions">
              <button type="button" className="link-button" disabled={saving} onClick={() => edit(batch)}>Edit batch</button>
              <button type="button" className="link-button" disabled={saving} onClick={() => void mutate(`/api/inventory-batches/${batch.batch_id}`, "PATCH", { depleted: !batch.depleted_at })}>{batch.depleted_at ? "Mark on hand" : "Mark depleted"}</button>
            </div>}
          </li>)}
        </ul>}
        {result && <PaginationControls pagination={result.pagination} disabled={loading || saving} onPageChange={(value) => { setPage(value); setLoading(true); }} onLimitChange={(value) => { setLimit(value); setPage(1); setLoading(true); }} ariaLabel="Inventory expiry pagination" />}
      </div>
      {product && <form className="expiry-form" onSubmit={save}>
        <h3>{editing ? "Edit batch" : "Record a batch"}</h3>
        <fieldset disabled={saving}>
          <label>Batch / lot number<input required maxLength={100} value={form.batch_number} onChange={(event) => setForm({ ...form, batch_number: event.target.value })} /></label>
          <label>Manufactured on (optional)<input type="date" value={form.manufactured_on} max={form.expires_on || undefined} onChange={(event) => setForm({ ...form, manufactured_on: event.target.value })} /></label>
          <label>Received on (defaults to today)<input type="date" value={form.received_on} onChange={(event) => setForm({ ...form, received_on: event.target.value })} /></label>
          <label>Expires on<input type="date" required value={form.expires_on} min={form.manufactured_on || undefined} onChange={(event) => setForm({ ...form, expires_on: event.target.value })} /></label>
          <label>Notes (optional)<textarea maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <div className="expiry-actions"><button className="btn-primary" type="submit">{saving ? "Saving…" : editing ? "Save changes" : "Add batch"}</button>
            {editing && <button className="btn-secondary" type="button" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel edit</button>}</div>
        </fieldset>
      </form>}
    </section>
  );

  if (!product) return content;
  return <div className="expiry-backdrop"><div className="expiry-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="expiry-dialog-title" tabIndex={-1}>{content}</div></div>;
}
