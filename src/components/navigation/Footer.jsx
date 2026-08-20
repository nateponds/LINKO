import { useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, MapPin } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { APP_NAV_ITEMS, ROLE_ACCESS } from "../../auth/roleAccess";
import SupportModal from "../ui/SupportModal";

function Footer() {
  const { hasAnyRole } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const marketplaceLinks = APP_NAV_ITEMS.filter(
    (item) =>
      ["/", "/orders", "/invoices"].includes(item.link) && hasAnyRole(item.roles),
  );
  const operationsLinks = APP_NAV_ITEMS.filter(
    (item) =>
      ["/dashboard", "/inventory", "/logistics"].includes(item.link) &&
      hasAnyRole(item.roles),
  );

  return (
    <>
    <footer className="app-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-wordmark">LINK<span>O</span></div>
          <p>Connecting MSMEs and buyers with trusted wholesalers across the Philippines.</p>
          <div className="footer-location"><MapPin size={15} /> Built for the Philippines</div>
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
          {hasAnyRole(ROLE_ACCESS.dashboard) && <Link to="/dashboard">Workspace</Link>}
          {hasAnyRole(["buyer", "wholesaler", "platform_admin"]) && <Link to="/orders">Orders</Link>}
          {hasAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]) && (
            <Link to="/logistics">Logistics</Link>
          )}
          <button
            type="button"
            className="footer-support-link"
            onClick={() => setSupportOpen(true)}
          >
            Customer Service
          </button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} LINKO. All rights reserved.</span>
        <span><Handshake size={15} /> Connecting business to opportunity.</span>
      </div>
    </footer>
    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}

export default Footer;
