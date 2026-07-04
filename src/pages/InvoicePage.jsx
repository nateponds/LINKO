import { useState, useEffect } from "react";
import { ArrowLeft, ArrowLeftRight, RotateCcw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import "./InvoicePage.css";

/* =====================================================================
   DATA LAYER
   ---------------------------------------------------------------------
   Stands in for a future database/API call. Replace fetchOrder() with
   a real request later, e.g.:

     async function fetchOrder(trackingNo) {
       const res = await fetch(`/api/orders/${trackingNo}`);
       if (!res.ok) return null;
       return res.json();
     }

   ...as long as the resolved object keeps this same shape, no other
   code on the page needs to change.
===================================================================== */

const MOCK_ORDER_DB = {
  21374: {
    trackingNo: "21374",
    shopName: "Linko Trading Co.",
    customer: {
      name: "Marielle Ocampo",
      contact: "+63 917 234 5678",
      address: "Blk 4 Lot 12, Banilad Rd, Cebu City, 6000",
    },
    seller: {
      name: "Sunhome Hardware Supplies",
      supportPhoneMasked: "+63 998 ******12",
      supportPhoneFull: "+63 998 765 4312",
      supportEmail: "support@sunhomehardware.com",
    },
    status: {
      eyebrow: "Your order is",
      title: "Delivered",
      sub: "as on 27 Jun 2026, Friday · last updated 29 Jun 2026, Sunday",
    },
    timeline: [
      { title: "Delivered", meta: "27 Jun 2026 · 2:30 PM — at Cebu City, PH", state: "current" },
      { title: "Out for delivery", meta: "27 Jun 2026 · 11:30 AM — at Cebu City, PH", state: "done" },
      { title: "In transit", meta: "25 Jun 2026 · 5:30 PM — Manila, PH → Cebu City, PH", state: "done" },
      { title: "Order picked up", meta: "24 Jun 2026 · 7:26 AM — from Manila, PH", state: "done" },
      { title: "Order received", meta: "23 Jun 2026 · 12:46 PM — at Manila, PH", state: "done" },
    ],
  },
};

/** Fetches a single order by tracking number. Resolves to an order object, or null if not found. */
function fetchOrder(trackingNo) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_ORDER_DB[trackingNo] || null);
    }, 250); // simulated network delay
  });
}

export default function InvoicePage() {
  /* ?tracking=XXXXX links here from the orders list, e.g. /invoices?tracking=21374 */
  const [searchParams] = useSearchParams();
  const trackingNo = searchParams.get("tracking") || "21374";
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [phoneRevealed, setPhoneRevealed] = useState(false);

  // Load the order whenever the tracking number changes.
  useEffect(() => {
    let cancelled = false;

    fetchOrder(trackingNo).then((result) => {
      if (cancelled) return;
      setOrder(result);
      setNotFound(!result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [trackingNo]);

  function handleBack() {
    navigate(-1);
  }

  function handleTogglePhone(e) {
    e.preventDefault();
    setPhoneRevealed((v) => !v);
  }

  return (
    <AppLayout>
      <div className="invoice-page">
        {/* back button + tracking number, below the shared header */}
        <div className="invoice-subbar">
          <button className="back-btn" onClick={handleBack}>
            <ArrowLeft size={15} /> Back
          </button>
          <div className="invoice-subbar-right">
            <span className="tracking-label">Tracking No.</span>
            <span className="tracking-number">
              {order ? `#${order.trackingNo}` : "\u2014"}
            </span>
          </div>
        </div>

      {/* ===== MAIN ===== */}
      {notFound ? (
        <div className="invoice-error">
          We couldn't find an order with that tracking number.
        </div>
      ) : (
        <main className="invoice-wrap" aria-busy={loading}>
          {/* LEFT: parties */}
          <aside className="parties">
            <div className="party-card">
              <div className="shop-name">{order?.shopName ?? "\u2014"}</div>

              <div className="party-block">
                <span className="field-label">Customer Name</span>
                <span className="field-value">{order?.customer.name ?? "\u2014"}</span>
              </div>
              <div className="party-block">
                <span className="field-label">Customer Contact</span>
                <span className="field-value">{order?.customer.contact ?? "\u2014"}</span>
              </div>
              <div className="party-block">
                <span className="field-label">Delivery Address</span>
                <span className="field-value">{order?.customer.address ?? "\u2014"}</span>
              </div>
            </div>

            <div className="party-card">
              <div className="party-block">
                <span className="field-label">Seller Name / Shop Name</span>
                <span className="field-value">{order?.seller.name ?? "\u2014"}</span>
              </div>
              <div className="party-block">
                <span className="field-label">Seller Support</span>
                <span className="field-value">
                  <span>
                    {order
                      ? phoneRevealed
                        ? order.seller.supportPhoneFull
                        : order.seller.supportPhoneMasked
                      : "\u2014"}
                  </span>
                  <a
                    href="#"
                    className="show-number"
                    onClick={handleTogglePhone}
                  >
                    {phoneRevealed ? "Hide number" : "Show number"}
                  </a>
                </span>
                <span className="field-value muted">
                  {order?.seller.supportEmail ?? "\u2014"}
                </span>
              </div>
            </div>
          </aside>

          {/* RIGHT: status + timeline */}
          <section className="status-panel">
            <div className="status-head">
              <div>
                <span className="status-eyebrow">{order?.status.eyebrow ?? "\u2014"}</span>
                <h1 className="status-title">{order?.status.title ?? "\u2014"}</h1>
                <span className="status-sub">{order?.status.sub ?? "\u2014"}</span>
              </div>

              <div className="status-actions">
                <a href="#" className="action-link"><RotateCcw size={13} /> Return order</a>
                <a href="#" className="action-link"><ArrowLeftRight size={13} /> Exchange item</a>
                <span className="delivery-query">
                  For delivery queries, <a href="#">contact us</a>
                </span>
              </div>
            </div>

            <div className="timeline-block">
              <span className="timeline-heading">Tracking History</span>

              <ol className="timeline">
                {order?.timeline.map((step) => (
                  <li
                    key={step.title + step.meta}
                    className={`tl-step ${
                      step.state === "current" ? "done current" : "done"
                    }`}
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
          </section>
        </main>
      )}
      </div>
    </AppLayout>
  );
}
