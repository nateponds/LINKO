import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowLeftRight, FileText, RotateCcw } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import { peso, shortDate, statusClass } from "../lib/format";
import "./InvoicePage.css";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  rejected: "Rejected",
};

const FULFILLMENT_STEPS = [
  { status: "pending", title: "Order received" },
  { status: "accepted", title: "Accepted by wholesaler" },
  { status: "preparing", title: "Preparing order" },
  { status: "shipped", title: "Shipped" },
  { status: "delivered", title: "Delivered" },
];

function normalizeStatus(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);
  return STATUS_LABELS[normalized] ?? (status || "Unknown");
}

function itemQuantity(invoice) {
  return Array.isArray(invoice?.items)
    ? invoice.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
    : 0;
}

function timelineFor(invoice) {
  const status = normalizeStatus(invoice?.order_status);

  if (
    status === "cancelled" ||
    status === "canceled" ||
    status === "rejected"
  ) {
    return [
      {
        title: statusLabel(invoice.order_status),
        meta: `Order ${statusLabel(invoice.order_status).toLowerCase()} after invoice issuance`,
        state: "current",
      },
      {
        title: "Invoice issued",
        meta: shortDate(invoice.issued_at),
        state: "done",
      },
    ];
  }

  const currentIndex = Math.max(
    FULFILLMENT_STEPS.findIndex((step) => step.status === status),
    0,
  );

  return FULFILLMENT_STEPS.slice(0, currentIndex + 1)
    .map((step, index) => ({
      title: step.title,
      meta:
        index === 0
          ? `Invoice ${invoice?.invoice_number ?? "issued"} on ${shortDate(invoice?.issued_at)}`
          : `Order status: ${step.title.toLowerCase()}`,
      state: index === currentIndex ? "current" : "done",
    }))
    .reverse();
}

export default function InvoicePage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadInvoices() {
      setLoading(true);
      setError(null);
      setInvoice(null);

      try {
        const data = invoiceId
          ? await apiGet(`/api/invoices/${encodeURIComponent(invoiceId)}`)
          : await apiGet("/api/invoices");

        if (!active) {
          return;
        }

        if (invoiceId) {
          setInvoice(data);
          setInvoices([]);
        } else {
          setInvoices(Array.isArray(data) ? data : []);
          setInvoice(null);
        }
      } catch (caughtError) {
        if (active) {
          setError(caughtError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInvoices();

    return () => {
      active = false;
    };
  }, [invoiceId]);

  const timeline = useMemo(() => timelineFor(invoice), [invoice]);

  function handleBack() {
    if (invoiceId) {
      navigate("/invoices");
      return;
    }

    navigate(-1);
  }

  return (
    <AppLayout>
      <div className="invoice-page">
        <div className="invoice-subbar">
          <button className="back-btn" onClick={handleBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="invoice-subbar-right">
            <span className="tracking-label">
              {invoiceId ? "Invoice No." : "Invoices"}
            </span>
            <span className="tracking-number">
              {invoiceId
                ? (invoice?.invoice_number ?? `#${invoiceId}`)
                : `${invoices.length} visible`}
            </span>
          </div>
        </div>

        {!invoiceId ? (
          <main className="invoice-list-wrap" aria-busy={loading}>
            <div className="invoice-list-head">
              <div>
                <span className="status-eyebrow">Billing workspace</span>
                <h1 className="status-title">Invoices</h1>
              </div>
              <FileText size={24} aria-hidden="true" />
            </div>

            {loading ? (
              <div className="invoice-error">Loading invoices...</div>
            ) : error ? (
              <div className="invoice-error">
                Could not load invoices: {error}. Backend is not running bruh
              </div>
            ) : invoices.length === 0 ? (
              <div className="invoice-error">
                No invoices are visible for this account yet.
              </div>
            ) : (
              <div className="invoice-list">
                {invoices.map((visibleInvoice) => (
                  <Link
                    className="invoice-list-row"
                    key={visibleInvoice.invoice_id}
                    to={`/invoices?invoice=${visibleInvoice.invoice_id}`}
                  >
                    <span>
                      <strong>{visibleInvoice.invoice_number}</strong>
                      <span className="invoice-row-meta">
                        Order #{visibleInvoice.order_id}
                      </span>
                    </span>
                    <span>
                      <span className="invoice-row-label">Buyer</span>
                      {visibleInvoice.buyer_business_name ?? "—"}
                    </span>
                    <span>
                      <span className="invoice-row-label">Seller</span>
                      {visibleInvoice.wholesaler_business_name ?? "—"}
                    </span>
                    <span>{shortDate(visibleInvoice.issued_at)}</span>
                    <span>{peso(visibleInvoice.total)}</span>
                    <span
                      className={`status ${statusClass(statusLabel(visibleInvoice.order_status))}`}
                    >
                      {statusLabel(visibleInvoice.order_status)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </main>
        ) : error && !loading ? (
          <div className="invoice-error">
            We couldn't find that invoice: {error}
          </div>
        ) : (
          <main className="invoice-wrap" aria-busy={loading}>
            <aside className="parties">
              <div className="party-card">
                <div className="shop-name">
                  {invoice?.invoice_number ?? "Loading invoice"}
                </div>

                <div className="party-block">
                  <span className="field-label">Buyer Business</span>
                  <span className="field-value">
                    {invoice?.buyer_business_name ?? "—"}
                  </span>
                </div>
                <div className="party-block">
                  <span className="field-label">Order No.</span>
                  <span className="field-value">
                    #{invoice?.order_id ?? "—"}
                  </span>
                </div>
                <div className="party-block">
                  <span className="field-label">Issued</span>
                  <span className="field-value">
                    {shortDate(invoice?.issued_at)}
                  </span>
                </div>
              </div>

              <div className="party-card">
                <div className="party-block">
                  <span className="field-label">Seller Name / Shop Name</span>
                  <span className="field-value">
                    {invoice?.wholesaler_business_name ?? "—"}
                  </span>
                </div>
                <div className="party-block">
                  <span className="field-label">Invoice Total</span>
                  <span className="field-value invoice-total">
                    {peso(invoice?.total)}
                  </span>
                </div>
                <div className="party-block">
                  <span className="field-label">Item Quantity</span>
                  <span className="field-value muted">
                    {itemQuantity(invoice)} units
                  </span>
                </div>
              </div>
            </aside>

            <section className="status-panel">
              <div className="status-head">
                <div>
                  <span className="status-eyebrow">Invoice order status</span>
                  <h1 className="status-title">
                    {statusLabel(invoice?.order_status)}
                  </h1>
                  <span className="status-sub">
                    Issued {shortDate(invoice?.issued_at)} for order #
                    {invoice?.order_id ?? "—"}
                  </span>
                </div>

                <div className="status-actions">
                  <Link to="/orders" className="action-link">
                    <RotateCcw size={13} /> View orders
                  </Link>
                  <Link to="/invoices" className="action-link">
                    <ArrowLeftRight size={13} /> All invoices
                  </Link>
                  <span className="delivery-query">
                    For invoice questions, use your LINKO order thread.
                  </span>
                </div>
              </div>

              <div className="timeline-block">
                <span className="timeline-heading">Order Timeline</span>

                <ol className="timeline">
                  {timeline.map((step) => (
                    <li
                      key={step.title + step.meta}
                      className={`tl-step ${step.state === "current" ? "done current" : "done"}`}
                    >
                      <span className="tl-dot" />
                      <div className="tl-content">
                        <span className="tl-title">{step.title}</span>
                        <span className="tl-meta">{step.meta}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="invoice-items">
                <span className="timeline-heading">Invoice Items</span>
                <table className="invoice-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice?.items ?? []).map((item) => (
                      <tr key={`${item.product_id}-${item.sku}`}>
                        <td>{item.product_name ?? "—"}</td>
                        <td>{item.sku ?? "—"}</td>
                        <td>{item.quantity ?? "—"}</td>
                        <td>{peso(item.unit_price_snapshot)}</td>
                        <td>{peso(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        )}
      </div>
    </AppLayout>
  );
}
