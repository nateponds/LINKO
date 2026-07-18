import "../assets/css/shell.css";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";
import Footer from "../components/navigation/Footer";
import MobileNav from "../components/navigation/MobileNav";
import { useAuth } from "../auth/AuthProvider";

// Missing-location reminder (Sprint 13 §9.2). Fully data-derived — no
// dismissal state: shows while the active buyer/wholesaler business has no
// pinned coordinates, disappears the moment a Settings save refreshes the
// session. Logistics-only businesses are exempt (no pin gates apply to them).
function MissingLocationBanner() {
  const { activeBusiness } = useAuth();
  if (!activeBusiness || activeBusiness.has_coordinates) return null;
  const isBuyer = activeBusiness.roles.includes("buyer");
  const isWholesaler = activeBusiness.roles.includes("wholesaler");
  if (!isBuyer && !isWholesaler) return null;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "0.5rem",
        padding: "0.6rem 1rem",
        background: "#fff7e6",
        color: "#7a4d00",
        borderBottom: "1px solid #f0d9a8",
        fontSize: "0.9rem",
      }}
    >
      <TriangleAlert size={16} />
      <span>
        <strong>{activeBusiness.business_name}</strong> has no pinned{" "}
        {isBuyer ? "delivery" : "pickup"} location —{" "}
        {isBuyer ? "orders can't be placed" : "orders can't be shipped"} until
        it is set.
      </span>
      <Link to="/settings/business-location" style={{ fontWeight: 600, color: "inherit" }}>
        Set location
      </Link>
    </div>
  );
}

function AppLayout({
  children,
  showSubNav = false,
  showSearch = false,
  showCategories = false,
}) {
  return (
    <div className="app-shell">
      <div className="app-layout">
        <Topbar showSearch={showSearch} showCategories={showCategories} />
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
