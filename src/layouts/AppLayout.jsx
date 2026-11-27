import "../assets/css/shell.css";
import { Link, NavLink, useLocation } from "react-router-dom";
import { TriangleAlert, LayoutDashboard, Boxes, ClipboardList, Receipt, Truck, Store, Settings } from "lucide-react";
import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";
import Footer from "../components/navigation/Footer";
import MobileNav from "../components/navigation/MobileNav";
import AlertBanner from "../components/ui/AlertBanner";
import { useAuth } from "../auth/AuthProvider";

// Missing-location reminder (Sprint 13 §9.2). Fully data-derived - no
// dismissal state: shows while the active buyer/wholesaler business has no
// pinned coordinates, disappears the moment a Settings save refreshes the
// session. Logistics-only businesses are exempt (no pin gates apply to them).
function MissingLocationBanner() {
  const { activeBusiness, hasAnyRole } = useAuth();
  if (!activeBusiness || activeBusiness.has_coordinates) return null;
  const isBuyer = hasAnyRole(["buyer"]);
  const isWholesaler = hasAnyRole(["wholesaler"]);
  if (!isBuyer && !isWholesaler) return null;

  return (
    <AlertBanner
      variant="warning"
      role="alert"
      className="missing-location-banner"
      action={
        <Link to="/settings/business-location" className="missing-location-banner__link">
          Set location
        </Link>
      }
    >
      <TriangleAlert size={16} aria-hidden="true" />
      <span>
        <strong>{activeBusiness.business_name}</strong> has no pinned{" "}
        {isBuyer ? "delivery" : "pickup"} location -{" "}
        {isBuyer ? "orders can't be placed" : "orders can't be shipped"} until
        it is set.
      </span>
    </AlertBanner>
  );
}

function AppLayout({
  children,
  showSubNav = false,
  showSearch = false,
  showCategories = false,
}) {
  const { activeBusiness, hasAnyRole } = useAuth();
  const { pathname } = useLocation();
  const sellerWorkspace = hasAnyRole(["wholesaler"]) && [
    "/dashboard", "/inventory", "/orders", "/invoices", "/logistics",
  ].some((path) => pathname === path || pathname.startsWith(path + "/"));
  const sellerLinks = [
    ["/dashboard", "Overview", LayoutDashboard],
    ["/inventory", "Products", Boxes],
    ["/orders", "Orders", ClipboardList],
    ["/invoices", "Invoices", Receipt],
    ["/logistics", "Logistics", Truck],
    ["/settings", "Settings", Settings],
  ];
  return (
    <div className={`app-shell${sellerWorkspace ? " seller-workspace" : ""}`}>
      {sellerWorkspace && (
        <aside className="seller-sidebar">
          <Link className="seller-wordmark" to="/dashboard">LINK<span>O</span></Link>
          <div className="seller-business"><span className="seller-business-icon"><Store size={19} /></span><strong>{activeBusiness?.business_name}</strong></div>
          <nav aria-label="Seller workspace">
            {sellerLinks.map(([path, label, Icon]) => (
              <NavLink key={path} to={path} className={({ isActive }) => isActive ? "active" : ""}>
                <Icon size={18} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>

        </aside>
      )}
      <div className="app-layout">
        {sellerWorkspace ? (
          <div className="seller-content-tools">
            <Link className="seller-marketplace-link" to="/"><Store size={16} />Marketplace</Link>
            <Topbar workspaceNavigation />
          </div>
        ) : (
          <Topbar showSearch={showSearch} showCategories={showCategories} />
        )}
        <MissingLocationBanner />
        {showSubNav && <SubNav />}
        <main className="app-layout__content">{children}</main>
        <Footer />
        <MobileNav />
      </div>
    </div>
  );
}

export default AppLayout;
