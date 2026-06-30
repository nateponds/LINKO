import Topbar from "../components/navigation/Topbar";
import SubNav from "../components/navigation/SubNav";

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Topbar />
      <SubNav />
      <main className="app-layout__content">{children}</main>
    </div>
  );
}

export default AppLayout;
