import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  Star,
  TriangleAlert,
  User,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { formatRoleLabel, getPrimaryMembership } from "../../auth/roleAccess";
import Sidebar from "./Sidebar";

const NOTIFICATIONS = [
  { id: 1, Icon: Package, text: "Order #21358 is now in transit", time: "2h ago" },
  { id: 2, Icon: TriangleAlert, text: "Low stock: AF41W - 8 units left", time: "5h ago" },
  { id: 3, Icon: Star, text: "New 5-star review on your shop", time: "Yesterday" },
];

function Topbar({ showSearch = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, memberships, logout, hasAnyRole } = useAuth();
  const qParam = searchParams.get("q") ?? "";
  const primaryMembership = getPrimaryMembership(memberships);
  const displayName = user?.full_name || user?.email || "LINKO User";
  const displayBusiness = primaryMembership?.business_name || "No business assigned";
  const displayRole = formatRoleLabel(
    user?.global_role === "platform_admin" ? user.global_role : primaryMembership?.role,
  );
  const avatarLetter = displayName.charAt(0).toUpperCase();

  function submitSearch(event) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") || "").trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  async function handleLogout() {
    setOpenPanel(null);
    setMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if (!openPanel) {
      return undefined;
    }

    function close() {
      setOpenPanel(null);
    }

    function handleKey(event) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("click", close);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openPanel]);

  function togglePanel(event, name) {
    event.stopPropagation();
    setOpenPanel((current) => (current === name ? null : name));
  }

  return (
    <>
      <div className="topbar">
        <span>
          Signed in as <strong>{displayName}</strong>
          {displayBusiness ? ` - ${displayBusiness}` : ""}
        </span>
      </div>
      <header className="header-nav">
        <Link to="/" className="logo">
          LINK<span className="logo-accent">O</span>
        </Link>
        {showSearch && (
          <form className="search" onSubmit={submitSearch} role="search">
            <input
              type="text"
              name="q"
              placeholder="Search products, suppliers, etc"
              defaultValue={qParam}
              key={qParam}
            />
            <button type="submit" className="icon-btn go" title="Search">
              <Search size={16} />
            </button>
          </form>
        )}
        <div className="header-actions">
          <div className="dropdown-anchor">
            <button
              className="icon-action"
              title="Notifications"
              aria-label={`Notifications (${NOTIFICATIONS.length} unread)`}
              aria-expanded={openPanel === "notifications"}
              onClick={(event) => togglePanel(event, "notifications")}
            >
              <Bell size={16} />
              <span className="notif-badge">{NOTIFICATIONS.length}</span>
            </button>
            {openPanel === "notifications" && (
              <div className="dropdown-panel" onClick={(event) => event.stopPropagation()}>
                <div className="dropdown-head">Notifications</div>
                <ul className="notif-list">
                  {NOTIFICATIONS.map(({ id, Icon, text, time }) => (
                    <li key={id}>
                      <span className="notif-icon">
                        <Icon size={16} />
                      </span>
                      <div>
                        <span className="notif-text">{text}</span>
                        <span className="notif-time">{time}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className="dropdown-foot"
                  onClick={() => setOpenPanel(null)}
                >
                  View all activity
                </Link>
              </div>
            )}
          </div>

          <button
            className="icon-action"
            title={menuOpen ? "Close menu" : "Menu"}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Menu size={16} />
          </button>

          <div className="dropdown-anchor">
            <button
              className="icon-action"
              title="Profile"
              aria-expanded={openPanel === "profile"}
              onClick={(event) => togglePanel(event, "profile")}
            >
              <User size={16} />
            </button>
            {openPanel === "profile" && (
              <div className="dropdown-panel" onClick={(event) => event.stopPropagation()}>
                <div className="profile-head">
                  <span className="profile-avatar">{avatarLetter}</span>
                  <div>
                    <span className="profile-name">{displayName}</span>
                    <span className="profile-biz">{displayBusiness}</span>
                    <span className="profile-meta">{displayRole}</span>
                  </div>
                </div>
                <nav className="dropdown-menu">
                  <Link to="/dashboard" onClick={() => setOpenPanel(null)}>
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  {hasAnyRole(["buyer", "wholesaler", "platform_admin"]) && (
                    <Link to="/inventory" onClick={() => setOpenPanel(null)}>
                      <Boxes size={15} /> Inventory
                    </Link>
                  )}
                  {hasAnyRole(["buyer", "wholesaler", "platform_admin"]) && (
                    <Link to="/orders" onClick={() => setOpenPanel(null)}>
                      <ClipboardList size={15} /> Orders
                    </Link>
                  )}
                  <button type="button">
                    <Settings size={15} /> Settings
                  </button>
                  <button type="button" className="danger" onClick={handleLogout}>
                    <LogOut size={15} /> Logout
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>
      <Sidebar
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default Topbar;
