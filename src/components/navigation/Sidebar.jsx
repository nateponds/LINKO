import { X } from "lucide-react";
import { Link } from "react-router-dom";

const menuItems = [
  { name: "Home", link: "/" },
  { name: "Inventory", link: "/inventory" },
  { name: "Invoices", link: "/invoices" },
  { name: "Dashboard", link: "/dashboard" },
  { name: "Wait List", link: "/waitlist" },
  { name: "Orders", link: "/orders" },
  { name: "Logout", link: null, className: "logout" },
];

function Sidebar({ isOpen, onClose }) {
  return (
    <aside className={`menu-overlay${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
      <button className="close-btn" type="button" onClick={onClose} aria-label="Close menu">
        <X size={28} />
      </button>
      <nav className="menu-items" aria-label="Main menu">
        {menuItems.map((item) =>
          item.link ? (
            <Link to={item.link} className={item.className} key={item.name} onClick={onClose}>
              {item.name}
            </Link>
          ) : (
            <a href="#" className={item.className} key={item.name}>
              {item.name}
            </a>
          ),
        )}
      </nav>
    </aside>
  );
}

export default Sidebar;
