import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  Camera,
  ClipboardList,
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
import Sidebar from "./Sidebar";

/* Mock notifications — swap for GET /api/notifications later; keep the shape. */
const NOTIFICATIONS = [
  { id: 1, Icon: Package, text: "Order #21358 is now in transit", time: "2h ago" },
  { id: 2, Icon: TriangleAlert, text: "Low stock: AF41W — 8 units left", time: "5h ago" },
  { id: 3, Icon: Star, text: "New 5-star review on your shop", time: "Yesterday" },
];

function Topbar({ showSearch = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState(null); // "notifications" | "profile" | null
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qParam = searchParams.get("q") ?? "";

  function submitSearch(e) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") || "").trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  // Any click outside a panel (or Escape) closes it.
  useEffect(() => {
    if (!openPanel) return;
    function close() {
      setOpenPanel(null);
    }
    function handleKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("click", close);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openPanel]);

  function togglePanel(e, name) {
    e.stopPropagation();
    setOpenPanel((prev) => (prev === name ? null : name));
  }

  return (
    <>
      <div className="topbar">
        <Link to="/become-a-supplier">Become a supplier &rarr;</Link>
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
            <button type="button" className="icon-btn" title="Search by image">
              <Camera size={16} />
            </button>
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
              aria-expanded={openPanel === "notifications"}
              onClick={(e) => togglePanel(e, "notifications")}
            >
              <Bell size={16} />
              <span className="notif-badge">{NOTIFICATIONS.length}</span>
            </button>
            {openPanel === "notifications" && (
              <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
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
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <Menu size={16} />
          </button>

          <div className="dropdown-anchor">
            <button
              className="icon-action"
              title="Profile"
              aria-expanded={openPanel === "profile"}
              onClick={(e) => togglePanel(e, "profile")}
            >
              <User size={16} />
            </button>
            {openPanel === "profile" && (
              <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
                <div className="profile-head">
                  <span className="profile-avatar">N</span>
                  <div>
                    <span className="profile-name">Nathaniel</span>
                    <span className="profile-biz">Linko Trading Co.</span>
                  </div>
                </div>
                <nav className="dropdown-menu" onClick={() => setOpenPanel(null)}>
                  <Link to="/dashboard">
                    <ClipboardList size={15} /> My Business
                  </Link>
                  <Link to="/inventory">
                    <Boxes size={15} /> Inventory
                  </Link>
                  <a href="#">
                    <Settings size={15} /> Settings
                  </a>
                  <a href="#" className="danger">
                    <LogOut size={15} /> Logout
                  </a>
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

export default Topbar;
