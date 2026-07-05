import { useEffect } from "react";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { APP_NAV_ITEMS, formatRoleLabel, getPrimaryMembership } from "../../auth/roleAccess";

function Sidebar({ isOpen, onClose, onLogout }) {
  const { user, memberships, hasAnyRole } = useAuth();
  const primaryMembership = getPrimaryMembership(memberships);
  const displayName = user?.full_name || user?.email || "LINKO User";
  const displayBusiness = primaryMembership?.business_name || "No business assigned";
  const displayRole = formatRoleLabel(
    user?.global_role === "platform_admin" ? user.global_role : primaryMembership?.role,
  );
  const menuItems = APP_NAV_ITEMS.filter((item) => hasAnyRole(item.roles));

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
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
        <div className="menu-profile">
          <span className="profile-avatar">{displayName.charAt(0).toUpperCase()}</span>
          <div>
            <div className="menu-profile-name">{displayName}</div>
            <div className="menu-profile-business">{displayBusiness}</div>
            <div className="menu-profile-role">{displayRole}</div>
          </div>
        </div>
        <nav className="menu-items" aria-label="Main menu">
          {menuItems.map((item) => (
            <NavLink
              to={item.link}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : undefined)}
              key={item.name}
              onClick={onClose}
            >
              {item.name}
            </NavLink>
          ))}
          <button type="button" className="logout menu-logout-button" onClick={onLogout}>
            Logout
          </button>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
