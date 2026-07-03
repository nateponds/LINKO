import { Link, useSearchParams } from "react-router-dom";
import { suppliers } from "../../data/suppliers";

function SupplierGrid() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");

  const visibleSuppliers = category
    ? suppliers.filter((supplier) => supplier.category === category)
    : suppliers;

  return (
    <>
      {category && (
        <div className="grid-filter-bar">
          <span>
            Showing suppliers for <strong>{category}</strong>
          </span>
          <Link to="/">Clear filter</Link>
        </div>
      )}

      {visibleSuppliers.length === 0 ? (
        <p className="grid-empty">No suppliers found for {category} yet.</p>
      ) : (
        <section className="content-grid" aria-label="Supplier results">
          {visibleSuppliers.map((supplier) => (
            <Link
              to={`/suppliers/${supplier.slug}`}
              className="supplier-box"
              key={supplier.slug}
            >
              <div className="supplier-box-image">
                <img
                  src={supplier.supplier_image}
                  alt={`${supplier.supplier_name} supplier`}
                />
              </div>
              <div className="supplier-box-info">
                <h3>{supplier.supplier_name}</h3>
                <p>Location: {supplier.location}</p>
                <p>
                  Rating: {"★".repeat(supplier.rating)}
                  {"☆".repeat(5 - supplier.rating)}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

export default SupplierGrid;
