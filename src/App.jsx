import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { CartProvider } from "./features/cart/CartProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ROUTE_ACCESS, redirectPathForRoles } from "./auth/roleAccess";
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
import LoginPage from "./pages/LoginPage";
import AddBusinessPage from "./pages/AddBusinessPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SettingsPage from "./pages/SettingsPage";
import CartPage from "./pages/CartPage";
import Profile from "./features/settings/Profile";
import BusinessLocation from "./features/settings/BusinessLocation";
import { AppShellSkeleton } from "./components/ui/pageSkeletons";

const TITLES = [
  ["/landing", "Wholesale Marketplace"],
  ["/register", "Register"],
  ["/businesses/new", "Add a business"],
  ["/login", "Log In"],
  ["/inventory", "My Products"],
  ["/invoices", "Invoice Tracking"],
  ["/dashboard", "Dashboard"],
  ["/orders", "Orders"],
  ["/logistics", "Logistics"],
  ["/admin", "Admin"],
  ["/settings", "Settings"],
  ["/cart", "Cart"],
  ["/suppliers/", "Supplier"],
];

/* Per-route document title + scroll restore on navigation. */
function RouteChrome() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = match
      ? `${match[1]} · LINKO`
      : "LINKO - Wholesale Marketplace";
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function UnknownRouteRedirect() {
  const { loading, user, activeRoles, isAdmin } = useAuth();

  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  const defaultPath = redirectPathForRoles(activeRoles, isAdmin);
  return <Navigate to={defaultPath} replace />;
}

// One guard per path, read from the route table, so no page inherits another
// page's role list by sitting in the same <Route> group.
function guarded(path, element) {
  return (
    <Route key={path} element={<ProtectedRoute roles={ROUTE_ACCESS[path]} />}>
      <Route path={path} element={element} />
    </Route>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {guarded("/", <SupplierDiscoveryPage />)}
      {guarded("/suppliers", <SupplierDiscoveryPage />)}
      {guarded("/suppliers/:supplierId", <SupplierProfilePage />)}
      {guarded("/businesses/new", <AddBusinessPage />)}
      {guarded("/cart", <CartPage />)}
      {guarded("/orders", <OrdersPage />)}
      {guarded("/invoices", <InvoicePage />)}
      {guarded("/dashboard", <DashboardPage />)}
      {guarded("/inventory", <InventoryPage />)}
      {guarded("/logistics", <LogisticsPage />)}
      {guarded("/logistics/management", <LogisticsManagementPage />)}
      {guarded("/logistics/:parcelId", <ParcelDetailPage />)}
      {guarded("/courier", <CourierDashboardPage />)}
      {guarded("/admin", <AdminDashboardPage />)}

      <Route element={<ProtectedRoute roles={ROUTE_ACCESS["/settings"]} />}>
        <Route path="/settings" element={<SettingsPage />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route
            element={
              <ProtectedRoute
                roles={ROUTE_ACCESS["/settings/business-location"]}
                redirectTo="/settings/profile"
              />
            }
          >
            <Route path="business-location" element={<BusinessLocation />} />
          </Route>
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
        <CartProvider>
          <RouteChrome />
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
