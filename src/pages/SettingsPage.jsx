import { Outlet, NavLink } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { User, MapPin } from "lucide-react";
import "../assets/css/settings.css";
import { useAuth } from "../auth/AuthProvider";
import { ROUTE_ACCESS } from "../auth/roleAccess";

const NAV_GROUPS = [
  {
    title: "Account",
    items: [
      { to: "/settings/profile", label: "Profile", icon: User },
    ],
  },
  {
    title: "Business",
    // Business settings belong to marketplace businesses only.
    roles: ROUTE_ACCESS["/settings/business-location"],
    items: [
      { to: "/settings/business-location", label: "Addresses", icon: MapPin },
    ],
  },
];

export default function SettingsPage() {
  const { hasAnyRole } = useAuth();
  const groups = NAV_GROUPS.filter((group) => !group.roles || hasAnyRole(group.roles));

  return (
    <AppLayout>
      <div className="settings-shell">
        <aside className="settings-nav-sidebar">
          <nav className="settings-nav" aria-label="Settings">
            {groups.map((group) => (
              <div key={group.title} className="settings-nav-group">
                <h3 className="settings-nav-group-title">{group.title}</h3>
                <div className="settings-nav-items">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `settings-nav-link ${isActive ? "active" : ""}`
                        }
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="settings-content-panel">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}
