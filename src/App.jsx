import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SupplierDiscoveryPage from "./pages/SupplierDiscoveryPage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";
import DashboardPage from "./pages/DashboardPage";
import WaitlistPage from "./pages/WaitlistPage";
import OrdersPage from "./pages/OrdersPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers/:supplierSlug" element={<SupplierProfilePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
