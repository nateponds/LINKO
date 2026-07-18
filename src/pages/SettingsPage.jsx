import { Outlet, NavLink } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { User, Shield, Briefcase, MapPin, Users, Bell } from "lucide-react";
import "../assets/css/settings.css";

const NAV_GROUPS = [
  {
    title: "Account",
    items: [
      { to: "/settings/profile", label: "Profile", icon: User, active: true },
      { to: "/settings/security", label: "Security", icon: Shield, active: false },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/settings/business-details", label: "Business Details", icon: Briefcase, active: false },
      { to: "/settings/business-location", label: "Business Location", icon: MapPin, active: true },
      { to: "/settings/team", label: "Team & Access", icon: Users, active: false },
    ],
  },
  {
    title: "Preferences",
    items: [
      { to: "/settings/notifications", label: "Notifications", icon: Bell, active: false },
    ],
  },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="settings-shell">
        <aside className="settings-nav-sidebar">
          <nav className="settings-nav">
            {NAV_GROUPS.map((group, i) => (
              <div key={i} className="settings-nav-group">
                <h3 className="settings-nav-group-title">{group.title}</h3>
                <div className="settings-nav-items">
                  {group.items.map((item, j) => {
                    const Icon = item.icon;
                    if (!item.active) {
                      return (
                        <button key={j} className="settings-nav-link disabled" disabled>
                          <Icon size={18} />
                          <span>{item.label}</span>
                          <span className="settings-badge">Coming soon</span>
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={j}
                        to={item.to}
                        className={({ isActive }) =>
                          `settings-nav-link ${isActive ? "active" : ""}`
                        }
                      >
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="settings-content-panel">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}
