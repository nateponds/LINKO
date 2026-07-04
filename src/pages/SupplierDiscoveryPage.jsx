import "./SupplierDiscoveryPage.css";
import { ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import SupplierGrid from "../features/suppliers/SupplierGrid";

function SupplierDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const isFiltered = searchParams.get("q") || searchParams.get("category");

  return (
    <AppLayout showSubNav showSearch>
      <div className="discovery-page">
        {!isFiltered && (
          <section className="home-hero">
            <div>
              <h1>Wholesale for your business, sourced nearby</h1>
              <p>
                Browse trusted wholesalers, compare offers, and get matched
                with suppliers close to you.
              </p>
            </div>
            <Link to="/matching" className="hero-cta">
              Find wholesalers near me <ArrowRight size={16} />
            </Link>
          </section>
        )}
        <SupplierGrid />
      </div>
    </AppLayout>
  );
}

export default SupplierDiscoveryPage;
