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
import { formatRoleLabel } from "../../auth/roleAccess";
import Sidebar from "./Sidebar";

function getIconForType(type) {
  if (type === "warning") return TriangleAlert;
  if (type === "success") return Star;
  return Package;
}

function Topbar({ showSearch = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user,
    memberships,
    activeBusinessId,
    activeMembership,
    setActiveBusiness,
    logout,
    hasAnyRole,
  } = useAuth();
  const qParam = searchParams.get("q") ?? "";
  const displayName = user?.full_name || user?.email || "LINKO User";
  const displayBusiness = activeMembership?.business_name || "No business assigned";
  const displayRole = formatRoleLabel(
    user?.global_role === "platform_admin" ? user.global_role : activeMembership?.role,
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

  useEffect(() => {
    let cancelled = false;
    async function loadNotifs() {
      try {
        const { apiGet } = await import("../../lib/api.js");
        const data = await apiGet("/api/notifications");
        if (!cancelled && Array.isArray(data)) {
          setNotifications(data);
        }
      } catch {
        // ignore
      }
    }
    if (!user) return () => { cancelled = true; };
    loadNotifs();
    const intervalId = setInterval(loadNotifs, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user]);

  async function markAsRead(id) {
    try {
      const { apiSend } = await import("../../lib/api.js");
      await apiSend(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function togglePanel(event, name) {
    event.stopPropagation();
    setOpenPanel((current) => (current === name ? null : name));
  }

  return (
    <>
      <div className="topbar">
        <span>
          Signed in as <strong>{displayName}</strong>
          {memberships.length > 1 ? (
            <>
              {" - "}
              <select
                className="business-switcher"
                aria-label="Active business"
                value={activeBusinessId ?? ""}
                onChange={(event) => setActiveBusiness(event.target.value)}
              >
                {memberships.map((membership) => (
                  <option
                    key={membership.business_id}
                    value={membership.business_id}
                  >
                    {membership.business_name} ({formatRoleLabel(membership.role)})
                  </option>
                ))}
              </select>
            </>
          ) : (
            displayBusiness ? ` - ${displayBusiness}` : ""
          )}
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
              aria-label={`Notifications (${notifications.length} unread)`}
              aria-expanded={openPanel === "notifications"}
              onClick={(event) => togglePanel(event, "notifications")}
            >
              <Bell size={16} />
              {notifications.length > 0 && <span className="notif-badge">{notifications.length}</span>}
            </button>
            {openPanel === "notifications" && (
              <div className="dropdown-panel" onClick={(event) => event.stopPropagation()}>
                <div className="dropdown-head">Notifications</div>
                <ul className="notif-list">
                  {notifications.length === 0 ? (
                    <li style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No new notifications</li>
                  ) : (
                    notifications.map((n) => {
                      const Icon = getIconForType(n.type);
                      return (
                        <li key={n.notification_id} onClick={() => markAsRead(n.notification_id)} style={{ cursor: 'pointer' }}>
                          <span className="notif-icon">
                            <Icon size={16} />
                          </span>
                          <div>
                            <span className="notif-text">{n.message}</span>
                            <span className="notif-time">{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
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
                  {hasAnyRole(["wholesaler", "platform_admin"]) && (
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
