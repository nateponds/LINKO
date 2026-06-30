import { X } from "lucide-react";

const menuItems = [
  { name: "Inventory", link: "inventory.html" },
  { name: "Dashboard", link: "#" },
  { name: "Wait List", link: "#" },
  { name: "Orders", link: "#" },
  { name: "Invoices", link: "#" },
  { name: "Logout", link: "#", className: "logout" },
];

function Sidebar({ isOpen, onClose }) {
  return (
    <aside className={`menu-overlay${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
      <button className="close-btn" type="button" onClick={onClose} aria-label="Close menu">
        <X size={28} />
      </button>
      <nav className="menu-items" aria-label="Main menu">
        {menuItems.map((item) => (
          <a href={item.link} className={item.className} key={item.name}>
            {item.name}
          </a>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
