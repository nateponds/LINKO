/* =====================================================================
   DATA LAYER
   ---------------------------------------------------------------------
   This stands in for a future database/API call. Everything the page
   displays — tracking no., customer, seller, status, and tracking
   history — comes from the object returned by fetchOrder().

   To wire this up to a real backend later, replace the body of
   fetchOrder() with an actual request, e.g.:

     async function fetchOrder(trackingNo) {
       const res = await fetch(`/api/orders/${trackingNo}`);
       if (!res.ok) return null;
       return res.json();
     }

   ...as long as the resolved object keeps this same shape, no other
   code on the page needs to change.
===================================================================== */

const MOCK_ORDER_DB = {
    "21374": {
      trackingNo: "21374",
      shopName: "Linko Trading Co.",
      customer: {
        name: "Marielle Ocampo",
        contact: "+63 917 234 5678",
        address: "Blk 4 Lot 12, Banilad Rd, Cebu City, 6000"
      },
      seller: {
        name: "Sunhome Hardware Supplies",
        supportPhoneMasked: "+63 998 ******12",
        supportPhoneFull: "+63 998 765 4312",
        supportEmail: "support@sunhomehardware.com"
      },
      status: {
        eyebrow: "Your order is",
        title: "Delivered",
        sub: "as on 27 Jun 2026, Friday · last updated 29 Jun 2026, Sunday"
      },
      timeline: [
        { title: "Delivered", meta: "27 Jun 2026 · 2:30 PM — at Cebu City, PH", state: "current" },
        { title: "Out for delivery", meta: "27 Jun 2026 · 11:30 AM — at Cebu City, PH", state: "done" },
        { title: "In transit", meta: "25 Jun 2026 · 5:30 PM — Manila, PH → Cebu City, PH", state: "done" },
        { title: "Order picked up", meta: "24 Jun 2026 · 7:26 AM — from Manila, PH", state: "done" },
        { title: "Order received", meta: "23 Jun 2026 · 12:46 PM — at Manila, PH", state: "done" }
      ]
    }
  };
  
  /**
   * Fetches a single order by tracking number.
   * Returns a Promise resolving to an order object, or null if not found.
   */
  function fetchOrder(trackingNo) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_ORDER_DB[trackingNo] || null);
      }, 250); // simulated network delay
    });
  }
  
  /**
   * Reads ?tracking=XXXXX from the URL so this page can be linked to
   * from an orders list, e.g. invoice_page.html?tracking=21374
   * Falls back to a default id if none is provided.
   */
  function getRequestedTrackingNo() {
    const params = new URLSearchParams(window.location.search);
    return params.get("tracking") || "21374";
  }
  
  
  /* =====================================================================
     RENDERING
  ===================================================================== */
  
  function renderOrder(order) {
    // Top bar
    document.getElementById("trackingNumber").textContent = `#${order.trackingNo}`;
  
    // Parties
    document.getElementById("shopName").textContent = order.shopName;
    document.getElementById("customerName").textContent = order.customer.name;
    document.getElementById("customerContact").textContent = order.customer.contact;
    document.getElementById("customerAddress").textContent = order.customer.address;
  
    document.getElementById("sellerName").textContent = order.seller.name;
    document.getElementById("sellerEmail").textContent = order.seller.supportEmail;
  
    const sellerPhoneEl = document.getElementById("sellerPhone");
    sellerPhoneEl.textContent = order.seller.supportPhoneMasked;
    sellerPhoneEl.dataset.masked = order.seller.supportPhoneMasked;
    sellerPhoneEl.dataset.full = order.seller.supportPhoneFull;
    sellerPhoneEl.dataset.revealed = "false";
  
    // Status
    document.getElementById("statusEyebrow").textContent = order.status.eyebrow;
    document.getElementById("statusTitle").textContent = order.status.title;
    document.getElementById("statusSub").textContent = order.status.sub;
  
    // Timeline
    const timelineEl = document.getElementById("timeline");
    timelineEl.innerHTML = "";
  
    order.timeline.forEach((step) => {
      const li = document.createElement("li");
      li.className = `tl-step ${step.state === "current" ? "done current" : "done"}`;
  
      li.innerHTML = `
        <span class="tl-dot"></span>
        <div class="tl-content">
          <span class="tl-title"></span>
          <span class="tl-meta"></span>
        </div>
      `;
  
      li.querySelector(".tl-title").textContent = step.title;
      li.querySelector(".tl-meta").textContent = step.meta;
  
      timelineEl.appendChild(li);
    });
  }
  
  function renderError() {
    const wrap = document.getElementById("invoiceWrap");
    wrap.setAttribute("aria-busy", "false");
    wrap.innerHTML = `
      <div class="invoice-error">
        We couldn't find an order with that tracking number.
      </div>
    `;
  }
  
  async function loadOrder() {
    const trackingNo = getRequestedTrackingNo();
    const order = await fetchOrder(trackingNo);
  
    if (!order) {
      renderError();
      return;
    }
  
    renderOrder(order);
    document.getElementById("invoiceWrap").setAttribute("aria-busy", "false");
  }
  
  
  /* =====================================================================
     UI BEHAVIOR (nav, back button, phone reveal)
  ===================================================================== */
  
  document.addEventListener("DOMContentLoaded", () => {
    loadOrder();
  
    /* ===== Overlay nav menu ===== */
    const navOverlay = document.getElementById("navOverlay");
    const navPanel = document.getElementById("navPanel");
    const menuToggle = document.getElementById("menuToggle");
    const navClose = document.getElementById("navClose");
  
    function openNav() {
      navOverlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  
    function closeNav() {
      navOverlay.classList.remove("open");
      document.body.style.overflow = "";
    }
  
    menuToggle.addEventListener("click", openNav);
    navClose.addEventListener("click", closeNav);
  
    navOverlay.addEventListener("click", (e) => {
      if (!navPanel.contains(e.target)) {
        closeNav();
      }
    });
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navOverlay.classList.contains("open")) {
        closeNav();
      }
    });
  
    /* ===== Back button ===== */
    const backBtn = document.getElementById("backBtn");
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      }
    });
  
    /* ===== Seller phone reveal ===== */
    const showNumberBtn = document.getElementById("showNumberBtn");
    showNumberBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const phoneEl = document.getElementById("sellerPhone");
      const revealed = phoneEl.dataset.revealed === "true";
  
      phoneEl.textContent = revealed ? phoneEl.dataset.masked : phoneEl.dataset.full;
      phoneEl.dataset.revealed = revealed ? "false" : "true";
      showNumberBtn.textContent = revealed ? "Show number" : "Hide number";
    });
  });