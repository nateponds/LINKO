import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { APP_NAV_ITEMS } from "../../auth/roleAccess";

function Footer() {
  const { hasAnyRole } = useAuth();
  const marketplaceLinks = APP_NAV_ITEMS.filter(
    (item) =>
      ["/", "/matching", "/orders", "/invoices"].includes(item.link) && hasAnyRole(item.roles),
  );
  const operationsLinks = APP_NAV_ITEMS.filter(
    (item) =>
      ["/dashboard", "/inventory", "/waitlist", "/logistics"].includes(item.link) &&
      hasAnyRole(item.roles),
  );

  return (
    <footer className="app-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="logo">
            LINK<span className="logo-accent">O</span>
          </div>
          <p>Connecting MSMEs and buyers with trusted wholesalers across the Philippines.</p>
        </div>
        <div className="footer-col">
          <h4>Marketplace</h4>
          {marketplaceLinks.map((item) => (
            <Link key={item.link} to={item.link}>
              {item.name}
            </Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Operations</h4>
          {operationsLinks.map((item) => (
            <Link key={item.link} to={item.link}>
              {item.name}
            </Link>
          ))}
        </div>
        <div className="footer-col">
          <h4>Account</h4>
          <Link to="/dashboard">Workspace</Link>
          {hasAnyRole(["buyer", "wholesaler", "platform_admin"]) && <Link to="/orders">Orders</Link>}
          {hasAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]) && (
            <Link to="/logistics">Logistics</Link>
          )}
        </div>
      </div>
      <div className="footer-bottom">© 2026 LINKO. All rights reserved.</div>
    </footer>
  );
}

export default Footer;
