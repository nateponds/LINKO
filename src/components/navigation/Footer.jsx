import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="logo">
            LINK<span className="logo-accent">O</span>
          </div>
          <p>
            Connecting MSMEs and buyers with trusted wholesalers across the
            Philippines.
          </p>
        </div>
        <div className="footer-col">
          <h4>Marketplace</h4>
          <Link to="/">Browse Suppliers</Link>
          <Link to="/matching">Find Wholesalers</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/invoices">Invoice Tracking</Link>
        </div>
        <div className="footer-col">
          <h4>Operations</h4>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/inventory">Inventory</Link>
          <Link to="/waitlist">Wait List</Link>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <Link to="/become-a-supplier">Become a Supplier</Link>
          <a href="#">About LINKO</a>
          <a href="#">Contact</a>
          <a href="#">Terms &amp; Privacy</a>
        </div>
      </div>
      <div className="footer-bottom">© 2026 LINKO. All rights reserved.</div>
    </footer>
  );
}

export default Footer;
