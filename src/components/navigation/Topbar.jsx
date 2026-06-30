import { useState } from "react";
import { Camera, Search, Bell, Menu, User } from "lucide-react";
import Sidebar from "./Sidebar";

function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleMenu() {
    setMenuOpen((prev) => !prev);
  }

  return (
    <>
      <div className="topbar">
        <a href="#">Become a supplier -&gt;</a>
      </div>
      <header className="header-nav">
        <div className="logo">LINKO</div>
        <div className="search">
          <input type="text" placeholder="Search products, suppliers, etc" />
          <button className="icon-btn" title="Search by image">
            <Camera size={16} />
          </button>
          <button className="icon-btn go" title="Search">
            <Search size={16} />
          </button>
        </div>
        <div className="header-actions">
          <button className="icon-action" title="Notifications">
            <Bell size={16} />
          </button>
          <button
            className="icon-action"
            title={menuOpen ? "Close menu" : "Menu"}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMenu}
          >
            <Menu size={16} />
          </button>
          <button className="icon-action" title="Profile">
            <User size={16} />
          </button>
        </div>
      </header>
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

export default Topbar;
