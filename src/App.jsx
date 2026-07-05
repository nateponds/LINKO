import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ROLE_ACCESS } from "./auth/roleAccess";
import SupplierDiscoveryPage from "./pages/SupplierDiscoveryPage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";
import DashboardPage from "./pages/DashboardPage";
import WaitlistPage from "./pages/WaitlistPage";
import OrdersPage from "./pages/OrdersPage";
import LogisticsPage from "./pages/LogisticsPage";
import LogisticsManagementPage from "./pages/LogisticsManagementPage";
import ParcelDetailPage from "./pages/ParcelDetailPage";
import CourierDashboardPage from "./pages/CourierDashboardPage";
import MatchingPage from "./pages/MatchingPage";
import BecomeSupplierPage from "./pages/BecomeSupplierPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

const TITLES = [
  ["/register", "Register"],
  ["/matching", "Find Wholesalers"],
  ["/become-a-supplier", "Become a Supplier"],
  ["/login", "Log In"],
  ["/inventory", "My Products"],
  ["/invoices", "Invoice Tracking"],
  ["/dashboard", "Dashboard"],
  ["/waitlist", "Wait List"],
  ["/orders", "Orders"],
  ["/logistics", "Logistics"],
  ["/suppliers/", "Supplier"],
];

/* Per-route document title + scroll restore on navigation. */
function RouteChrome() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = match ? `${match[1]} · LINKO` : "LINKO — Wholesale Marketplace";
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function UnknownRouteRedirect() {
  const { loading, user, hasAnyRole } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const defaultPath = (hasAnyRole(["buyer"]) && !hasAnyRole(["wholesaler", "platform_admin", "logistics_coordinator", "courier"])) ? "/" : "/dashboard";
  return <Navigate to={defaultPath} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.marketplace} />}>
        <Route path="/" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers/:supplierId" element={<SupplierProfilePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/become-a-supplier" element={<BecomeSupplierPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.matching} />}>
        <Route path="/matching" element={<MatchingPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={ROLE_ACCESS.logistics} />}>
        <Route path="/logistics" element={<LogisticsPage />} />
        <Route path="/logistics/management" element={<LogisticsManagementPage />} />
        <Route path="/logistics/:parcelId" element={<ParcelDetailPage />} />
        <Route path="/logistics/book" element={<Navigate to="/logistics" replace />} />
        <Route path="/courier" element={<CourierDashboardPage />} />
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
