import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ROLE_ACCESS, redirectPathForRoles } from "./auth/roleAccess";
import SupplierDiscoveryPage from "./pages/SupplierDiscoveryPage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import LogisticsPage from "./pages/logistics/LogisticsPage";
import LogisticsManagementPage from "./pages/logistics/LogisticsManagementPage";
import ParcelDetailPage from "./pages/logistics/ParcelDetailPage";
import CourierDashboardPage from "./pages/logistics/CourierDashboardPage";
import BecomeSupplierPage from "./pages/BecomeSupplierPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import Profile from "./features/settings/Profile";
import BusinessLocation from "./features/settings/BusinessLocation";

const TITLES = [
  ["/register", "Register"],
  ["/become-a-supplier", "Become a Supplier"],
  ["/login", "Log In"],
  ["/inventory", "My Products"],
  ["/invoices", "Invoice Tracking"],
  ["/dashboard", "Dashboard"],
  ["/orders", "Orders"],
  ["/logistics", "Logistics"],
  ["/admin", "Admin"],
  ["/settings", "Settings"],
  ["/suppliers/", "Supplier"],
];

/* Per-route document title + scroll restore on navigation. */
function RouteChrome() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = match
      ? `${match[1]} · LINKO`
      : "LINKO — Wholesale Marketplace";
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function UnknownRouteRedirect() {
  const { loading, user, activeRoles } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const defaultPath = redirectPathForRoles(activeRoles, user.global_role === "platform_admin");
  return <Navigate to={defaultPath} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.dashboard} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.marketplace} />}>
        <Route path="/" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers" element={<SupplierDiscoveryPage />} />
        <Route
          path="/suppliers/:supplierId"
          element={<SupplierProfilePage />}
        />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/become-a-supplier" element={<BecomeSupplierPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.inventory} />}>
        <Route path="/inventory" element={<InventoryPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.logistics} />}>
        <Route path="/logistics" element={<LogisticsPage />} />
        <Route path="/logistics/:parcelId" element={<ParcelDetailPage />} />
        <Route path="/courier" element={<CourierDashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.logisticsManagement} />}>
        <Route
          path="/logistics/management"
          element={<LogisticsManagementPage />}
        />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.admin} />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.settings} />}>
        <Route path="/settings" element={<SettingsPage />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="business-location" element={<BusinessLocation />} />
          <Route path="*" element={<Navigate to="profile" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<UnknownRouteRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteChrome />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
