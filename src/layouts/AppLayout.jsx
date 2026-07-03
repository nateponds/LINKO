import "../assets/css/shell.css";
import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";

function AppLayout({ children, showSubNav = false }) {
  return (
    <div className="app-shell">
      <div className="app-layout">
        <Topbar />
        {showSubNav && <SubNav />}
        <main className="app-layout__content">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
