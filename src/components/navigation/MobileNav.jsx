import { NavLink } from "react-router-dom";
import { Boxes, ClipboardList, LayoutDashboard, Store, Truck } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { ROLE_ACCESS } from "../../auth/roleAccess";

const items = [
  { name: "Home", link: "/", Icon: Store, end: true, roles: ["buyer", "wholesaler", "platform_admin"] },
  { name: "Orders", link: "/orders", Icon: ClipboardList, roles: ["buyer", "wholesaler", "platform_admin"] },
  { name: "Inventory", link: "/inventory", Icon: Boxes, roles: ["wholesaler", "platform_admin"] },
  { name: "Logistics", link: "/logistics", Icon: Truck, roles: ["wholesaler", "logistics_coordinator", "courier", "platform_admin"] },
  { name: "Dashboard", link: "/dashboard", Icon: LayoutDashboard, roles: ROLE_ACCESS.dashboard },
];

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
