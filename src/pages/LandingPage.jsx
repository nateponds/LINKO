import { useRef, useState } from "react";
import { ArrowRight, Handshake, MapPin, Menu, Package, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { redirectPathForRoles } from "../auth/roleAccess";
import HeroVideoPreview from "../features/landing/HeroVideoPreview";
import { BANNERS } from "../lib/productBanners";
import "../assets/css/shell.css";
import "./SupplierDiscoveryPage.css";
import "./BecomeSupplierPage.css";
import "../assets/css/landing.css";

const MILK_BANNER = BANNERS[0];
const CALAMANSI_BANNER = BANNERS[2];
const DESTINATION_LABELS = {
  "/": "Enter marketplace",
  "/logistics": "Open logistics",
  "/courier": "Courier dashboard",
  "/admin": "Admin dashboard",
  "/dashboard": "Open dashboard",
};

const PERKS = [
  {
    Icon: MapPin,
    title: "Search wholesalers by name or location",
    desc: "Find wholesaler profiles using a business name or location search.",
  },
  {
    Icon: Handshake,
    title: "Review listed products and unit prices",
    desc: "Compare the products and unit prices each wholesaler lists.",
  },
  {
    Icon: ShieldCheck,
    title: "Verified supplier profiles",
    desc: "Supplier profiles show the business checks buyers use before they order.",
  },
  {
    Icon: Package,
    title: "Orders and parcels in one place",
    desc: "Orders and parcel updates stay together after checkout.",
  },
];

function LandingBanner({ banner, destination, className = "", priority = false }) {
  const { background, color, ...position } = banner.button;
  const to = destination?.path ?? "/register";
  const label = destination?.label ?? "Register";

  return (
    <section className={`home-banner ${className}`.trim()}>
      <Link to={to}>
        <img
          src={banner.image}
          alt={banner.alt}
          fetchPriority={priority ? "high" : "auto"}
        />
        <span className="home-banner-btn" style={{ ...position, background, color }}>
          {label} <ArrowRight size={16} />
        </span>
      </Link>
    </section>
  );
}

export default function LandingPage() {
  const { user, activeRoles } = useAuth();
  const signedIn = Boolean(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef(null);
  const year = new Date().getFullYear();
  const destinationPath = signedIn
    ? redirectPathForRoles(activeRoles, user.global_role === "platform_admin")
    : null;
  const destination = destinationPath
    ? { path: destinationPath, label: DESTINATION_LABELS[destinationPath] }
    : null;

  function closeMenu(event) {
    setMenuOpen(false);
    const targetId = event.currentTarget.getAttribute("href")?.slice(1);
    if (targetId) {
      document.getElementById(targetId)?.focus({ preventScroll: true });
    }
  }

  function handleMenuKeyDown(event) {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    }
  }

  return (
    <div className="app-shell landing-page">
      <a className="landing-skip-link" href="#main-content">Skip to content</a>

      <div className="app-layout">
        <header className="header-nav" onKeyDown={handleMenuKeyDown}>
          <Link className="logo" to="/landing">
            <img src="/images/linko.png" alt="LINKO" />
          </Link>

          <button
            ref={menuToggleRef}
            type="button"
            className="icon-action landing-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="landing-nav-links"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <nav
            id="landing-nav-links"
            className={menuOpen ? "landing-nav-links is-open" : "landing-nav-links"}
            aria-label="Landing page"
          >
            <a href="#how" onClick={closeMenu}>How it works</a>
            <a href="#tour" onClick={closeMenu}>Product tour</a>
            <a href="#workflow" onClick={closeMenu}>Workflow</a>
          </nav>

          <div className="header-actions">
            {signedIn ? (
              <Link className="btn-primary" to={destination.path}>{destination.label}</Link>
            ) : (
              <>
                <Link className="landing-login" to="/login">Log in</Link>
                <Link className="btn-primary" to="/register">Register</Link>
              </>
            )}
          </div>
        </header>

        <main id="main-content">
          <section className="landing-hero" aria-labelledby="landing-heading">
            <div className="landing-shell landing-hero-grid">
              <div className="landing-hero-copy">
                <h1 id="landing-heading">
                  The marketplace connecting MSMEs with trusted wholesalers.
                </h1>
                <p>
                  Search wholesalers by name or location, review listed unit prices, and follow parcel updates after shipment.
                </p>
                <div className="hero-actions">
                  {signedIn ? (
                    <Link className="btn-primary" to={destination.path}>
                      {destination.label} <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                  ) : (
                    <>
                      <Link className="btn-primary" to="/register">
                        Register <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                      <Link className="btn-secondary" to="/login">Log in</Link>
                    </>
                  )}
                </div>
              </div>

              <div className="discovery-page landing-hero-banner">
                <LandingBanner
                  banner={MILK_BANNER}
                  destination={destination}
                  className="home-banner--hero"
                  priority
                />
              </div>
            </div>
          </section>

          <section className="become-supplier-page landing-how" id="how" tabIndex={-1}>
            <h2>How it works</h2>
            <p className="landing-lead">
              Search supplier listings, review listed product prices, and manage orders in one marketplace.
            </p>
            <div className="landing-perk-grid">
              {PERKS.map(({ Icon, title, desc }) => (
                <article className="perk-card" key={title}>
                  <span className="perk-icon">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="discovery-page">
            <LandingBanner banner={CALAMANSI_BANNER} destination={destination} />
          </div>

          <section className="landing-section" id="tour" tabIndex={-1}>
            <h2>Product tour</h2>
            <p>See supplier search, listed product prices, orders, and parcel tracking in this recorded tour.</p>
            <HeroVideoPreview />
          </section>

          <section className="landing-section landing-section--workflow" id="workflow" tabIndex={-1}>
            <h2>From search to delivery</h2>
            <p>See how LINKO supports buyers from supplier discovery through shipment updates.</p>
            <ol className="landing-workflow-steps">
              <li>
                <span className="landing-workflow-step-number" aria-hidden="true">1</span>
                <div>
                  <h3>Find wholesalers</h3>
                  <p>Search by business name or location.</p>
                </div>
              </li>
              <li>
                <span className="landing-workflow-step-number" aria-hidden="true">2</span>
                <div>
                  <h3>Review listed products</h3>
                  <p>Check product listings and unit prices published by wholesalers.</p>
                </div>
              </li>
              <li>
                <span className="landing-workflow-step-number" aria-hidden="true">3</span>
                <div>
                  <h3>Order and follow delivery</h3>
                  <p>Place orders and follow parcel updates after shipment.</p>
                </div>
              </li>
            </ol>
          </section>
        </main>

        <footer className="app-footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-wordmark">LINK<span>O</span></div>
              <p>Connecting MSMEs and buyers with trusted wholesalers across the Philippines.</p>
              <div className="footer-location">
                <MapPin size={15} aria-hidden="true" /> Built for the Philippines
              </div>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#tour">Product tour</a>
              <a href="#workflow">Workflow</a>
            </div>
            <div className="footer-col">
              <h4>Account</h4>
              {signedIn ? (
                <Link to={destination.path}>{destination.label}</Link>
              ) : (
                <>
                  <Link to="/register">Register</Link>
                  <Link to="/login">Log in</Link>
                </>
              )}
            </div>
            <div className="footer-col">
              <h4>Suppliers</h4>
              <Link to={signedIn ? "/become-a-supplier" : "/register"}>Become a supplier</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {year} LINKO. All rights reserved.</span>
            <span>
              <Handshake size={15} aria-hidden="true" /> Connecting business to opportunity.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
