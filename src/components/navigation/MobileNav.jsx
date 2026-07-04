import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, MapPin, Store } from "lucide-react";

const items = [
  { name: "Home", link: "/", Icon: Store, end: true },
  { name: "Nearby", link: "/matching", Icon: MapPin },
  { name: "Orders", link: "/orders", Icon: ClipboardList },
  { name: "Inventory", link: "/inventory", Icon: Boxes },
  { name: "Dashboard", link: "/dashboard", Icon: LayoutDashboard },
];

/* Bottom tab bar, shown on narrow screens only (see shell.css). */
function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {items.map(({ name, link, Icon, end }) => (
        <NavLink
          key={name}
          to={link}
          end={end}
          className={({ isActive }) => (isActive ? "active" : undefined)}
        >
          <Icon size={20} />
          <span>{name}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileNav;
