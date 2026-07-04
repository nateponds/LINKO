import "../assets/css/shell.css";
import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";
import Footer from "../components/navigation/Footer";

function AppLayout({ children, showSubNav = false, showSearch = false }) {
  return (
    <div className="app-shell">
      <div className="app-layout">
        <Topbar showSearch={showSearch} />
        {showSubNav && <SubNav />}
        <main className="app-layout__content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export default AppLayout;
