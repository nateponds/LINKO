import "../assets/css/shell.css";
import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";
import Footer from "../components/navigation/Footer";
import MobileNav from "../components/navigation/MobileNav";

function AppLayout({
  children,
  showSubNav = false,
  showSearch = false,
  showCategories = false,
}) {
  return (
    <div className="app-shell">
      <div className="app-layout">
        <Topbar showSearch={showSearch} showCategories={showCategories} />
        {showSubNav && <SubNav />}
        <main className="app-layout__content">{children}</main>
        <Footer />
        <MobileNav />
      </div>
    </div>
  );
}

export default AppLayout;
