import { useEffect } from "react";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";

const menuItems = [
  { name: "Home", link: "/", end: true },
  { name: "Inventory", link: "/inventory" },
  { name: "Invoices", link: "/invoices" },
  { name: "Dashboard", link: "/dashboard" },
  { name: "Wait List", link: "/waitlist" },
  { name: "Orders", link: "/orders" },
  { name: "Logout", link: null, className: "logout" },
];

function Sidebar({ isOpen, onClose }) {
  // Close on Escape and lock page scroll while the menu is open.
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`menu-backdrop${isOpen ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`menu-overlay${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
        <button className="close-btn" type="button" onClick={onClose} aria-label="Close menu">
          <X size={28} />
        </button>
        <nav className="menu-items" aria-label="Main menu">
          {menuItems.map((item) =>
            item.link ? (
              <NavLink
                to={item.link}
                end={item.end}
                className={({ isActive }) => (isActive ? "active" : undefined)}
                key={item.name}
                onClick={onClose}
              >
                {item.name}
              </NavLink>
            ) : (
              <a href="#" className={item.className} key={item.name}>
                {item.name}
              </a>
            ),
          )}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
