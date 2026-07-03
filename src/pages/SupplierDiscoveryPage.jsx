import "../assets/css/style.css";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";

function SupplierDiscoveryPage() {
  return (
    <div className="discovery-page">
      <AppLayout>
        <SupplierGrid />
      </AppLayout>
    </div>
  );
}

export default SupplierDiscoveryPage;
