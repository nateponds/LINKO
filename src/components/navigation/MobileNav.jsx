import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Store, Truck } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { ROUTE_ACCESS } from "../../auth/roleAccess";

const items = [
  { name: "Home", link: "/", Icon: Store, end: true },
  { name: "Orders", link: "/orders", Icon: ClipboardList },
  { name: "Inventory", link: "/inventory", Icon: Boxes },
  { name: "Logistics", link: "/logistics", Icon: Truck },
  { name: "Dashboard", link: "/dashboard", Icon: LayoutDashboard },
].map((item) => ({ ...item, roles: ROUTE_ACCESS[item.link] }));

function MobileNav() {
  const { hasAnyRole } = useAuth();
  const visibleItems = items.filter((item) => hasAnyRole(item.roles));

  return (
    <nav className="mobile-nav" aria-label="Primary">
      {visibleItems.map(({ name, link, Icon, end }) => (
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
