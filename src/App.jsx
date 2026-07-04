import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import SupplierDiscoveryPage from "./pages/SupplierDiscoveryPage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";
import DashboardPage from "./pages/DashboardPage";
import WaitlistPage from "./pages/WaitlistPage";
import OrdersPage from "./pages/OrdersPage";
import MatchingPage from "./pages/MatchingPage";
import BecomeSupplierPage from "./pages/BecomeSupplierPage";

const TITLES = [
  ["/matching", "Find Wholesalers"],
  ["/become-a-supplier", "Become a Supplier"],
  ["/inventory", "Inventory"],
  ["/invoices", "Invoice Tracking"],
  ["/dashboard", "Dashboard"],
  ["/waitlist", "Wait List"],
  ["/orders", "Orders"],
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

function App() {
  return (
    <BrowserRouter>
      <RouteChrome />
      <Routes>
        <Route path="/" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers/:supplierSlug" element={<SupplierProfilePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/become-a-supplier" element={<BecomeSupplierPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
