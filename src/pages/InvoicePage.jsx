import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, FileText, RotateCcw, Search } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { apiGet } from "../lib/api";
import PaginationControls from "../components/ui/PaginationControls";
import { useListUrlState } from "../hooks/useListUrlState";
import { peso, shortDate, statusClass } from "../lib/format";
import "./InvoicePage.css";

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  returned: "Returned",
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
    status === "returned" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "rejected"
  ) {
    return [
      {
        title: statusLabel(invoice.order_status),
        meta:
          status === "returned"
            ? "Delivery failed; order returned to sender"
            : `Order ${statusLabel(invoice.order_status).toLowerCase()} after invoice issuance`,
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

function useInvoicePage(path, enabled) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState({ data: null, error: null, key: null });
  const key = `${path}:${reloadVersion}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const controller = new AbortController();
    apiGet(path, { signal: controller.signal })
      .then((data) => active && setState({ data, error: null, key }))
      .catch((error) => {
        if (active && error?.name !== "AbortError") {
          setState((previous) => ({ data: previous.data, error, key }));
        }
      });
    return () => { active = false; controller.abort(); };
  }, [enabled, key, path]);

  const current = enabled && state.key === key;
  return {
    data: current ? state.data : null,
    staleData: state.data,
    error: current ? state.error : null,
    loading: enabled && !current,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}

export default function InvoicePage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoice");
  const navigate = useNavigate();
  const location = useLocation();
  const list = useListUrlState();

  const listQuery = new URLSearchParams({ page: String(list.page), limit: String(list.limit) });
  if (list.q) listQuery.set("q", list.q);
  const listResource = useInvoicePage(`/api/invoices?${listQuery.toString()}`, !invoiceId);
  const searchTimerRef = useRef(null);
  const listData = listResource.data ?? listResource.staleData;
  const invoices = listData?.items ?? null;
  const listPagination = listData?.pagination ?? null;
  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [errorInvoice, setErrorInvoice] = useState(null);

  useEffect(() => {
    return () => window.clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    const totalPages = listResource.data?.pagination?.total_pages ?? 0;
    if (totalPages > 0 && list.page > totalPages) {
      list.update({ page: totalPages }, { replace: true });
    }
  }, [list, listResource.data]);

  function queueSearch(nextQuery) {
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => list.setQuery(nextQuery), 300);
  }

  useEffect(() => {
    let active = true;
    if (!invoiceId) return;

    async function loadInvoice() {
      setLoadingInvoice(true);
      setErrorInvoice(null);
      try {
        const data = await apiGet(`/api/invoices/${encodeURIComponent(invoiceId)}`);
        if (active) setInvoice(data);
      } catch (caughtError) {
        if (active) setErrorInvoice(caughtError.message);
      } finally {
        if (active) setLoadingInvoice(false);
      }
    }
    void loadInvoice();
    return () => { active = false; };
  }, [invoiceId]);

  const timeline = useMemo(() => timelineFor(invoice), [invoice]);

  function handleBack() {
    if (invoiceId) {
      const params = new URLSearchParams(location.search);
      params.delete("invoice");
      navigate({ pathname: "/invoices", search: params.toString() ? `?${params.toString()}` : "" });
      return;
    }

    navigate(-1);
  }

  function listSearch() {
    const params = new URLSearchParams(location.search);
    params.delete("invoice");
    return params.toString() ? `?${params.toString()}` : "";
  }

  return (
    <AppLayout>
      <div className="invoice-page">
        <div className="invoice-subbar">
          {invoiceId ? (
            <button className="back-btn" onClick={handleBack}>
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div />
          )}
          <div className="invoice-subbar-right">
            <span className="tracking-label">
              {invoiceId ? "Invoice No." : "Invoices"}
            </span>
            <span className="tracking-number">
              {invoiceId
                ? (invoice?.invoice_number ?? `#${invoiceId}`)
                : `${listPagination?.total_items ?? 0} visible`}
            </span>
          </div>
        </div>

        {!invoiceId ? (
          <main className="invoice-list-wrap" aria-busy={listResource.loading}>
            <div className="invoice-list-head">
              <div>
                <span className="status-eyebrow">Billing workspace</span>
                <h1 className="status-title">Invoices</h1>
              </div>
              <div className="invoice-list-actions">
                <label className="invoice-list-search">
                  <span className="sr-only">Search invoices</span>
                  <input
                    type="search"
                    placeholder="Search invoice, order, buyer, seller"
                    key={list.q}
                    defaultValue={list.q}
                    onChange={(event) => queueSearch(event.target.value)}
                  />
                  <Search size={16} aria-hidden="true" />
                </label>
                <FileText size={24} aria-hidden="true" />
              </div>
            </div>

            {invoices === null && listResource.loading ? (
              <div className="invoice-error">Loading invoices...</div>
            ) : listResource.error && !invoices?.length ? (
              <div className="invoice-error">
                Could not load invoices: {listResource.error.message}
              </div>
            ) : (invoices?.length ?? 0) === 0 ? (
              <div className="invoice-error">
                {list.q ? "No invoices match your search." : "No invoices are visible for this account yet."}
                {list.q && (
                  <button className="clear-list-filters" type="button" onClick={() => list.setQuery("")}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                {listResource.error && <div className="invoice-error invoice-error--inline">Could not refresh invoices: {listResource.error.message}</div>}
                <div className="invoice-list">
                  <div className="invoice-list-header" aria-hidden="true">
                    <span>Invoice</span>
                    <span>Buyer</span>
                    <span>Seller</span>
                    <span>Issued</span>
                    <span>Total</span>
                    <span>Status</span>
                  </div>
                  {invoices.map((visibleInvoice) => {
                    const detailParams = new URLSearchParams(location.search);
                    detailParams.set("invoice", visibleInvoice.invoice_id);
                    return (
                  <Link
                    className="invoice-list-row"
                    key={visibleInvoice.invoice_id}
                    to={`/invoices?${detailParams.toString()}`}
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
                    );
                  })}
                </div>
                <PaginationControls
                  pagination={listPagination}
                  disabled={listResource.loading}
                  onPageChange={list.setPage}
                  onLimitChange={list.setLimit}
                  ariaLabel="Invoice pagination"
                />
              </>
            )}
          </main>
        ) : errorInvoice && !loadingInvoice ? (
          <div className="invoice-error">
            We couldn't find that invoice: {errorInvoice}
          </div>
        ) : (
          <main className="invoice-wrap" aria-busy={loadingInvoice}>
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
                  <Link to={{ pathname: "/invoices", search: listSearch() }} className="action-link">
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
