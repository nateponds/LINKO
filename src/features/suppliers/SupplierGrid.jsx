import { Link, useSearchParams } from "react-router-dom";
import { suppliers } from "../../data/suppliers";
import StarRating from "../../components/ui/StarRating";

function SupplierGrid() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const query = (searchParams.get("q") ?? "").trim();
  const q = query.toLowerCase();

  const visibleSuppliers = suppliers.filter((supplier) => {
    if (category && supplier.category !== category) return false;
    return (
      !q ||
      supplier.supplier_name.toLowerCase().includes(q) ||
      supplier.location.toLowerCase().includes(q) ||
      supplier.category.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {(category || query) && (
        <div className="grid-filter-bar">
          <span>
            Showing {visibleSuppliers.length} supplier
            {visibleSuppliers.length === 1 ? "" : "s"}
            {query && <> for &ldquo;{query}&rdquo;</>}
            {category && (
              <>
                {" "}
                in <strong>{category}</strong>
              </>
            )}
          </span>
          <Link to="/">Clear</Link>
        </div>
      )}

      {visibleSuppliers.length === 0 ? (
        <p className="grid-empty">
          No suppliers found. Try a different search or category.
        </p>
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
                <p className="supplier-rating">
                  <StarRating rating={supplier.rating} />
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
