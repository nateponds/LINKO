import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Factory,
  Handshake,
  MapPin,
  PackageCheck,
  PackageSearch,
  Search,
  Sparkles,
  Star,
  Store,
  Truck,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import HeroVideoPreview from "../features/landing/HeroVideoPreview";
import SavingsCalculator from "../features/landing/SavingsCalculator";
import "../assets/css/landing.css";

const PILLARS = [
  {
    number: "01",
    icon: Search,
    title: "Direct supplier discovery",
    copy: "Find nearby wholesalers through precise geo-proximity filters built for faster sourcing.",
    preview: "discovery",
  },
  {
    number: "02",
    icon: CircleDollarSign,
    title: "Transparent bulk tier pricing",
    copy: "See price breaks before you order, so every higher-volume purchase has a clear payoff.",
    preview: "pricing",
  },
  {
    number: "03",
    icon: Truck,
    title: "Integrated parcel tracking",
    copy: "Follow every shipment milestone in one shared view, from dispatch through proof of delivery.",
    preview: "tracking",
  },
  {
    number: "04",
    icon: BadgeCheck,
    title: "Verified supplier badging",
    copy: "Build confidence faster with visible business checks and marketplace trust signals.",
    preview: "verification",
  },
];

const PERSONAS = {
  buyer: {
    label: "I am an MSME Buyer",
    eyebrow: "SOURCE WITH CONFIDENCE",
    title: "Turn a messy buying process into one clear workflow.",
    copy: "Compare wholesalers, understand bulk prices, manage orders, and follow parcels without juggling spreadsheets and chat threads.",
    benefits: [
      "Discover wholesalers near your business",
      "Compare transparent volume-based prices",
      "Track orders and parcels in one place",
    ],
  },
  wholesaler: {
    label: "I am a Wholesaler",
    eyebrow: "GROW THE RIGHT DEMAND",
    title: "Put your catalog in front of buyers ready to purchase.",
    copy: "Showcase products, publish clear wholesale tiers, receive qualified orders, and build trust through a verified presence.",
    benefits: [
      "Reach location-relevant business buyers",
      "Manage catalog, orders, and inventory",
      "Earn trust through verification signals",
    ],
  },
};

const TESTIMONIALS = [
  {
    quote:
      "LINKO helped us replace three weeks of supplier calls with one focused afternoon of comparison.",
    name: "Mika Reyes",
    role: "Operations Lead · Cornerstone Retail",
    initials: "MR",
  },
  {
    quote:
      "Clear price tiers changed how we plan stock. We know the savings before the order leaves our desk.",
    name: "Paolo Lim",
    role: "Owner · Northline Provisions",
    initials: "PL",
  },
  {
    quote:
      "The shared parcel timeline gives our team one answer when a customer asks where an order is.",
    name: "Ana Santos",
    role: "Supply Manager · Verde Essentials",
    initials: "AS",
  },
];

function PillarPreview({ type }) {
  if (type === "pricing") {
    return (
      <div className="pillar-ui price-stack" aria-hidden="true">
        <div><span>50+</span><strong>₱128</strong></div>
        <div className="is-selected"><span>200+</span><strong>₱112</strong></div>
        <div><span>500+</span><strong>₱96</strong></div>
      </div>
    );
  }

  if (type === "tracking") {
    return (
      <div className="pillar-ui tracking-line" aria-hidden="true">
        <span className="is-complete"><Check size={12} /></span>
        <i />
        <span className="is-complete"><Warehouse size={12} /></span>
        <i />
        <span className="is-active"><Truck size={12} /></span>
        <i />
        <span><PackageCheck size={12} /></span>
      </div>
    );
  }

  if (type === "verification") {
    return (
      <div className="pillar-ui verification-list" aria-hidden="true">
        <span><Check size={13} /> Business registration</span>
        <span><Check size={13} /> Contact verified</span>
        <span><Check size={13} /> Fulfilment history</span>
      </div>
    );
  }

  return (
    <div className="pillar-ui discovery-map" aria-hidden="true">
      <span className="map-orbit map-orbit--one" />
      <span className="map-orbit map-orbit--two" />
      <MapPin className="map-pin map-pin--one" size={21} />
      <MapPin className="map-pin map-pin--two" size={18} />
      <span className="map-route" />
      <small>8.4 km away</small>
    </div>
  );
}

function DashboardPreview({ persona }) {
  const buyer = persona === "buyer";

  return (
    <div className="portal-window" aria-label={`${buyer ? "Buyer" : "Wholesaler"} dashboard preview`}>
      <div className="portal-window__bar">
        <span /><span /><span />
        <small>app.linko.ph/{buyer ? "marketplace" : "catalog"}</small>
      </div>
      <div className="portal-window__body">
        <aside>
          <div className="mini-logo">L</div>
          {[Boxes, PackageSearch, BarChart3, Truck].map((Icon, index) => (
            <span className={index === 0 ? "is-active" : ""} key={Icon.displayName || index}>
              <Icon size={16} />
            </span>
          ))}
        </aside>
        <div className="portal-content">
          <div className="portal-title">
            <div>
              <small>{buyer ? "MARKETPLACE" : "WHOLESALE HUB"}</small>
              <strong>{buyer ? "Find your next supplier" : "Catalog performance"}</strong>
            </div>
            <span><Search size={14} /> Search</span>
          </div>
          <div className="portal-metrics">
            {(buyer
              ? [["12", "Nearby"], ["₱24K", "Saved"], ["4", "Active orders"]]
              : [["2.4K", "Views"], ["186", "Orders"], ["98%", "Fulfilled"]]
            ).map(([value, label]) => (
              <div key={label}><strong>{value}</strong><small>{label}</small></div>
            ))}
          </div>
          <div className="portal-list">
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <span className={`portal-thumb portal-thumb--${item + 1}`} />
                <span>
                  <strong>
                    {buyer
                      ? ["Metro Goods Co.", "PrimePack Supply", "AgriCore Trading"][item]
                      : ["Cooking Oil 1L", "Kraft Mailer Box", "All-purpose Flour"][item]}
                  </strong>
                  <small>{buyer ? `${3 + item * 4}.${item + 2} km away` : `${68 - item * 11} units sold`}</small>
                </span>
                <b>{buyer ? "Verified" : `+${12 + item * 5}%`}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [persona, setPersona] = useState("buyer");
  const [testimonial, setTestimonial] = useState(0);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => {
      setTestimonial((current) => (current + 1) % TESTIMONIALS.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  function changeTestimonial(direction) {
    setTestimonial((current) =>
      (current + direction + TESTIMONIALS.length) % TESTIMONIALS.length,
    );
  }

  function submitNewsletter(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  }

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#main-content">Skip to content</a>

      <header className="landing-header">
        <nav className="landing-nav" aria-label="Landing page navigation">
          <Link className="landing-logo" to="/landing" aria-label="LINKO home">
            <div className="auth-brand-mark landing-brand-mark">
              LINK<span>O</span>
            </div>
          </Link>
          <div className="landing-nav__links">
            <a href="#why-linko">Why LINKO</a>
            <a href="#platform">Platform</a>
            <a href="#savings">Savings</a>
          </div>
          <div className="landing-nav__actions">
            <Link className="nav-login" to="/login">Log in</Link>
            <Link className="nav-join" to="/register">
              Join LINKO <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="landing-hero">
          <div className="hero-ambient hero-ambient--one" />
          <div className="hero-ambient hero-ambient--two" />
          <div className="landing-shell hero-grid">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <span className="hero-kicker">
                <span><Zap size={13} fill="currentColor" /></span>
                ONE PLATFORM FOR REPEAT BUSINESS
              </span>
              <h1>
                One wholesale network.
                <span>Every business connection.</span>
              </h1>
              <p>
                Find verified wholesalers and business buyers, compare recurring
                supply costs, manage orders, and track deliveries without jumping
                between apps.
              </p>
              <div className="hero-actions">
                <Link className="button button--primary" to="/register">
                  Start sourcing now <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="button button--glass" to="/suppliers">
                  Explore marketplace
                </Link>
              </div>
              <div className="hero-proof" aria-label="LINKO platform advantages">
                <div className="proof-avatars" aria-hidden="true">
                  <span>MK</span><span>AR</span><span>JL</span><span>+</span>
                </div>
                <div>
                  <span className="proof-stars">
                    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={12} fill="currentColor" />)}
                  </span>
                  <strong>Trusted by growing Philippine businesses</strong>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="hero-scene"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.12 }}
            >
              <HeroVideoPreview />
            </motion.div>
          </div>

          <div className="landing-shell hero-trust-row">
            <span>POWERING SMARTER TRADE FOR</span>
            <div><Store size={18} /> Independent retailers</div>
            <div><Factory size={18} /> Local wholesalers</div>
            <div><Building2 size={18} /> Growing enterprises</div>
            <div><Warehouse size={18} /> Distribution teams</div>
          </div>
        </section>

        <section className="friction-section" id="why-linko">
          <div className="landing-shell">
            <div className="section-heading section-heading--center">
              <span className="eyebrow">THE FRICTIONLESS SUPPLY CHAIN</span>
              <h2>Less chasing. More moving.</h2>
              <p>LINKO replaces fragmented sourcing with one visible, connected flow.</p>
            </div>

            <div className="comparison-grid">
              <motion.article
                className="comparison-card comparison-card--old"
                initial={{ opacity: 0, x: -35 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="comparison-label"><X size={15} /> THE OLD WAY</div>
                <h3>Every order starts from zero.</h3>
                <div className="old-flow" aria-hidden="true">
                  <span><Clock3 size={19} /></span>
                  <i />
                  <span><PackageSearch size={19} /></span>
                  <i />
                  <span><CircleDollarSign size={19} /></span>
                </div>
                <ul>
                  <li><X size={15} /> Supplier searches across scattered channels</li>
                  <li><X size={15} /> Prices hidden inside long conversations</li>
                  <li><X size={15} /> Shipment updates living in separate threads</li>
                </ul>
              </motion.article>

              <motion.article
                className="comparison-card comparison-card--linko"
                initial={{ opacity: 0, x: 35 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="comparison-glow" />
                <div className="comparison-label"><Sparkles size={15} /> THE LINKO WAY</div>
                <h3>One connection keeps everything moving.</h3>
                <div className="linko-flow" aria-hidden="true">
                  <div><Store size={20} /><small>BUYER</small></div>
                  <span><i /><b>LINKO</b><i /></span>
                  <div><Warehouse size={20} /><small>WHOLESALER</small></div>
                </div>
                <ul>
                  <li><Check size={15} /> Location-relevant supplier discovery</li>
                  <li><Check size={15} /> Visible wholesale pricing tiers</li>
                  <li><Check size={15} /> Shared order and parcel timelines</li>
                </ul>
              </motion.article>
            </div>
          </div>
        </section>

        <section className="platform-section" id="platform">
          <div className="landing-shell">
            <div className="section-heading section-heading--split">
              <div>
                <span className="eyebrow">BUILT FOR REAL B2B WORK</span>
                <h2>Four pillars. One connected platform.</h2>
              </div>
              <p>
                Everything buyers and wholesalers need to find each other,
                transact clearly, and stay aligned after checkout.
              </p>
            </div>

            <div className="pillar-grid">
              {PILLARS.map(({ icon: Icon, ...pillar }, index) => (
                <motion.article
                  className="pillar-card"
                  key={pillar.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={reduceMotion ? undefined : { y: -8, rotateX: 2, rotateY: -2 }}
                >
                  <div className="pillar-card__top">
                    <span><Icon size={20} /></span>
                    <small>{pillar.number}</small>
                  </div>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.copy}</p>
                  <PillarPreview type={pillar.preview} />
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="savings-section" id="savings">
          <div className="landing-shell">
            <div className="section-heading section-heading--center section-heading--light">
              <span className="eyebrow">THE NUMBERS SHOULD WORK HARDER</span>
              <h2>Turn volume into visible value.</h2>
              <p>Adjust your numbers and see the annual opportunity in real time.</p>
            </div>
            <SavingsCalculator />
          </div>
        </section>

        <section className="persona-section">
          <div className="landing-shell">
            <div className="persona-switch" role="group" aria-label="Choose your LINKO experience">
              {Object.entries(PERSONAS).map(([key, details]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setPersona(key)}
                  className={persona === key ? "is-active" : ""}
                  aria-pressed={persona === key}
                >
                  {key === "buyer" ? <Store size={17} /> : <Warehouse size={17} />}
                  {details.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                className="persona-grid"
                key={persona}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.32 }}
              >
                <div className="persona-copy">
                  <span className="eyebrow">{PERSONAS[persona].eyebrow}</span>
                  <h2>{PERSONAS[persona].title}</h2>
                  <p>{PERSONAS[persona].copy}</p>
                  <ul>
                    {PERSONAS[persona].benefits.map((benefit) => (
                      <li key={benefit}><Check size={15} /> {benefit}</li>
                    ))}
                  </ul>
                  <Link to="/register">
                    Build your LINKO workspace <ArrowRight size={17} />
                  </Link>
                </div>
                <DashboardPreview persona={persona} />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <section className="testimonials-section">
          <div className="landing-shell testimonials-grid">
            <div className="testimonial-heading">
              <span className="eyebrow">BUILT WITH BUSINESS IN MIND</span>
              <h2>Clearer sourcing makes stronger businesses.</h2>
              <div className="testimonial-controls">
                <button type="button" onClick={() => changeTestimonial(-1)} aria-label="Previous testimonial">
                  <ChevronLeft size={19} />
                </button>
                <span>{String(testimonial + 1).padStart(2, "0")} / {String(TESTIMONIALS.length).padStart(2, "0")}</span>
                <button type="button" onClick={() => changeTestimonial(1)} aria-label="Next testimonial">
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>

            <div className="testimonial-stage">
              <AnimatePresence mode="wait">
                <motion.article
                  key={testimonial}
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  className="testimonial-card"
                >
                  <div className="quote-mark">“</div>
                  <div className="testimonial-stars">
                    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={16} fill="currentColor" />)}
                  </div>
                  <blockquote>{TESTIMONIALS[testimonial].quote}</blockquote>
                  <footer>
                    <span>{TESTIMONIALS[testimonial].initials}</span>
                    <div>
                      <strong>{TESTIMONIALS[testimonial].name}</strong>
                      <small>{TESTIMONIALS[testimonial].role}</small>
                    </div>
                    <BadgeCheck size={22} />
                  </footer>
                </motion.article>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="cta-orbit cta-orbit--one" />
          <div className="cta-orbit cta-orbit--two" />
          <div className="landing-shell final-cta__inner">
            <span className="eyebrow">YOUR NEXT SUPPLIER IS CLOSER THAN YOU THINK</span>
            <h2>Build a supply chain that moves at your speed.</h2>
            <p>Join the connected marketplace made for ambitious Philippine businesses.</p>
            <div>
              <Link className="button button--primary" to="/register">
                Start sourcing now <ArrowRight size={18} />
              </Link>
              <Link className="button button--glass" to="/login">Sign in to LINKO</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell footer-grid">
          <div className="footer-brand">
            <div className="footer-wordmark">LINK<span>O</span></div>
            <p>The connected wholesale marketplace for buyers and wholesalers.</p>
            <div className="footer-location"><MapPin size={15} /> Built for the Philippines</div>
          </div>
          <div className="footer-links">
            <div><strong>Platform</strong><a href="#platform">Features</a><a href="#savings">Savings</a></div>
            <div><strong>Access</strong><Link to="/register">Create account</Link><Link to="/login">Log in</Link><Link to="/suppliers">Find suppliers</Link></div>
          </div>
          <div className="footer-newsletter">
            <strong>Get marketplace updates</strong>
            <p>New categories, sourcing tips, and product updates—once a month.</p>
            {subscribed ? (
              <div className="newsletter-success"><Check size={16} /> You&apos;re on the list.</div>
            ) : (
              <form onSubmit={submitNewsletter}>
                <label className="sr-only" htmlFor="landing-email">Business email</label>
                <input
                  id="landing-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Business email"
                />
                <button type="submit" aria-label="Subscribe to LINKO updates">
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="landing-shell footer-bottom">
          <span>© {new Date().getFullYear()} LINKO. All rights reserved.</span>
          <div><a href="#main-content">Privacy</a><a href="#main-content">Terms</a></div>
          <span><Handshake size={15} /> Connecting business to opportunity.</span>
        </div>
      </footer>
    </div>
  );
}
