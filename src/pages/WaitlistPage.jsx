import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Search, Trash2 } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import "./WaitlistPage.css";

/* Mock data layer — swap for GET /api/waitlist later; keep the shape.
   A waitlist entry = a customer waiting on an out-of-stock product. */
const INITIAL_WAITLIST = [
  { id: 1, customer: "Marielle Ocampo", contact: "+63 917 234 5678", product: "Something Product Name", sku: "AF41W", qty: 12, since: "25 Jun 2026", notified: false },
  { id: 2, customer: "Joseph Ramirez", contact: "+63 998 111 2233", product: "Something Product Name", sku: "AF41W", qty: 5, since: "26 Jun 2026", notified: false },
  { id: 3, customer: "Ana Villanueva", contact: "+63 917 555 8899", product: "Something Product Name", sku: "B7K02", qty: 30, since: "28 Jun 2026", notified: true },
  { id: 4, customer: "Carlo Mendoza", contact: "+63 926 444 7788", product: "Something Product Name", sku: "C3D19", qty: 8, since: "30 Jun 2026", notified: false },
  { id: 5, customer: "Bea Santos", contact: "+63 915 222 6611", product: "Something Product Name", sku: "AF41W", qty: 20, since: "1 Jul 2026", notified: false },
];

export default function WaitlistPage() {
  // Demo persistence: notify/remove actions survive reloads until a real API exists.
  const [waitlist, setWaitlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("linko-waitlist")) ?? INITIAL_WAITLIST;
    } catch {
      return INITIAL_WAITLIST;
    }
  });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    localStorage.setItem("linko-waitlist", JSON.stringify(waitlist));
  }, [waitlist]);

  const visibleWaitlist = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return waitlist;
    return waitlist.filter(
      (w) =>
        w.customer.toLowerCase().includes(term) ||
        w.product.toLowerCase().includes(term) ||
        w.sku.toLowerCase().includes(term)
    );
  }, [waitlist, searchTerm]);

  const waitingCount = waitlist.filter((w) => !w.notified).length;

  function notifyEntry(id) {
    setWaitlist((prev) => prev.map((w) => (w.id === id ? { ...w, notified: true } : w)));
  }

  function removeEntry(id) {
    setWaitlist((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <AppLayout>
      <div className="waitlist-page">
        <div className="page-head">
          <div>
            <h1>Wait List</h1>
            <span className="waitlist-sub">
              {waitingCount} customer{waitingCount === 1 ? "" : "s"} waiting on restock
            </span>
            <p className="page-demo-note">
              Demo data — not yet connected to the live backend.
            </p>
          </div>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search customer, product, SKU"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-icon-btn" aria-label="Search"><Search size={16} /></button>
          </div>
        </div>

        <main className="table-card">
          {visibleWaitlist.length === 0 ? (
            <div className="page-empty">
              {waitlist.length === 0
                ? "Wait list is empty — every customer has been notified or served."
                : "No entries match your search."}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty Wanted</th>
                  <th>Waiting Since</th>
                  <th>Status</th>
                  <th>Notify</th>
                  <th className="remove-column" aria-label="Remove"></th>
                </tr>
              </thead>
              <tbody>
                {visibleWaitlist.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.customer}</strong></td>
                    <td>{w.contact}</td>
                    <td>{w.product}</td>
                    <td>{w.sku}</td>
                    <td>{w.qty}</td>
                    <td>{w.since}</td>
                    <td>
                      <span className={`status ${w.notified ? "notified" : "waiting"}`}>
                        {w.notified ? "Notified" : "Waiting"}
                      </span>
                    </td>
                    <td className="notify-action">
                      {w.notified ? (
                        <span className="notified-check" title="Customer notified">
                          <Check size={15} /> Sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="notify-btn"
                          onClick={() => notifyEntry(w.id)}
                        >
                          <Bell size={14} /> Notify
                        </button>
                      )}
                    </td>
                    <td className="remove-column">
                      <button
                        type="button"
                        className="remove-btn"
                        aria-label={`Remove ${w.customer} from wait list`}
                        onClick={() => removeEntry(w.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
