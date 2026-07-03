import "./SupplierDiscoveryPage.css";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";

function SupplierDiscoveryPage() {
  return (
    <AppLayout showSubNav showSearch>
      <div className="discovery-page">
        <SupplierGrid />
      </div>
    </AppLayout>
  );
}

export default SupplierDiscoveryPage;
