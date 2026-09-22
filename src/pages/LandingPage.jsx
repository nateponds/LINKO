import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import HeroVideoPreview from "../features/landing/HeroVideoPreview";
import SavingsCalculator from "../features/landing/SavingsCalculator";
import "../assets/css/landing.css";

const SLIP_LINES = [
  {
    label: "Find",
    title: "A wholesaler near the store",
    copy: "Search suppliers by place, then open the one that actually stocks what you reorder.",
  },
  {
    label: "Price",
    title: "The bulk tier, before you commit",
    copy: "Volume breaks sit on the product. You see the price change before the order is sent.",
  },
  {
    label: "Order",
    title: "The purchase stays in LINKO",
    copy: "The order, the invoice, and the conversation about that order live in one record.",
  },
  {
    label: "Parcel",
    title: "Dispatch through delivery",
    copy: "Both sides follow the same parcel timeline, from the warehouse to proof of delivery.",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">Skip to content</a>

      <header className="landing-header">
        <nav className="landing-nav" aria-label="Landing page navigation">
          <Link className="landing-logo" to="/landing" aria-label="LINKO home" onClick={closeMenu}>
            <div className="auth-brand-mark landing-brand-mark">
              LINK<span>O</span>
            </div>
          </Link>

          <button
            type="button"
            className="landing-nav__toggle"
            aria-expanded={menuOpen}
            aria-controls="landing-nav-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>

          <div
            id="landing-nav-panel"
            className={menuOpen ? "landing-nav__panel is-open" : "landing-nav__panel"}
          >
            <div className="landing-nav__links">
              <a href="#hall" onClick={closeMenu}>How it works</a>
              <a href="#savings" onClick={closeMenu}>Price estimate</a>
            </div>
            <div className="landing-nav__actions">
              {user ? (
                <Link className="nav-market" to="/" onClick={closeMenu}>Enter marketplace</Link>
              ) : null}
              <Link className="nav-login" to="/login" onClick={closeMenu}>Log in</Link>
              <Link className="nav-supplier" to="/become-a-supplier" onClick={closeMenu}>
                Become a supplier
              </Link>
              <Link className="nav-join" to="/register" onClick={closeMenu}>Register</Link>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div className="hero-bleed" aria-hidden="true" />
          <div className="hero-grid">
            <div className="hero-copy">
              <h1>Reorder wholesale here.</h1>
              <p>
                Store owners find a wholesaler, read the bulk price, and follow the parcel.
              </p>
              <div className="hero-actions">
                {user ? (
                  <Link className="button button--primary" to="/">Enter marketplace</Link>
                ) : (
                  <Link className="button button--primary" to="/register">Register</Link>
                )}
                <Link className="button button--quiet" to="/login">Log in</Link>
              </div>
            </div>
            <HeroVideoPreview />
          </div>
        </section>

        <section className="hall-section" id="hall">
          <div className="landing-shell">
            <div className="section-heading">
              <h2>What an order looks like</h2>
              <p>
                LINKO is the counter between a Philippine store and the wholesaler who supplies it.
              </p>
            </div>
            <ol className="slip-list">
              {SLIP_LINES.map((line) => (
                <li key={line.label}>
                  <span>{line.label}</span>
                  <div>
                    <h3>{line.title}</h3>
                    <p>{line.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="savings-section" id="savings">
          <div className="landing-shell savings-layout">
            <div className="section-heading">
              <h2>Price the difference yourself</h2>
              <p>
                Move the sliders. The rate runs from 15% to 32%, and the result is only an estimate.
              </p>
            </div>
            <SavingsCalculator />
          </div>
        </section>

        <section className="counter-section" id="trade">
          <div className="landing-shell counter-grid">
            <article>
              <h2>If you run a store</h2>
              <p>Reorder from wholesalers you can locate, with the tier price in view.</p>
              <ul>
                <li>Discover wholesalers near your business</li>
                <li>Compare volume prices before you buy</li>
                <li>Track the order and the parcel together</li>
              </ul>
              <Link className="text-link" to="/register">Register</Link>
            </article>
            <article>
              <h2>If you wholesale</h2>
              <p>Publish the catalog, name the tiers, and take orders from store buyers.</p>
              <ul>
                <li>List products with wholesale price tiers</li>
                <li>Receive orders from business buyers</li>
                <li>Show a verified business on the catalog</li>
              </ul>
              <Link className="text-link" to="/become-a-supplier">Become a supplier</Link>
              <p className="fine-print">You sign in before the supplier form opens.</p>
            </article>
          </div>
        </section>

        <section className="close-section">
          <div className="landing-shell close-inner">
            <h2>Open an account and walk in.</h2>
            <p>Register as a store. A wholesaler who already buys here can apply to sell.</p>
            <div className="hero-actions">
              <Link className="button button--primary" to="/register">Register</Link>
              <Link className="button button--quiet" to="/login">Log in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell footer-grid">
          <div className="footer-brand">
            <div className="footer-wordmark">LINK<span>O</span></div>
            <p>A wholesale marketplace for Philippine store owners and the wholesalers who supply them.</p>
          </div>
          <div className="footer-links">
            <a href="#hall">How it works</a>
            <a href="#savings">Price estimate</a>
            <Link to="/register">Register</Link>
            <Link to="/login">Log in</Link>
            <Link to="/become-a-supplier">Become a supplier</Link>
          </div>
        </div>
        <div className="landing-shell footer-bottom">
          <span>© {new Date().getFullYear()} LINKO. All rights reserved.</span>
          <span>Built for the Philippines</span>
        </div>
      </footer>
    </div>
  );
}
