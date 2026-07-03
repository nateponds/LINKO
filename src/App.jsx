import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SupplierDiscoveryPage from "./pages/SupplierDiscoveryPage";
import SupplierProfilePage from "./pages/SupplierProfilePage";
import InventoryPage from "./pages/InventoryPage";
import InvoicePage from "./pages/InvoicePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SupplierDiscoveryPage />} />
        <Route path="/suppliers/:supplierSlug" element={<SupplierProfilePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
