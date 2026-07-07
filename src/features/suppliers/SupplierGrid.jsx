import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { apiGet } from "../../lib/api";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1586528116311-ad8ed745d44c?auto=format&fit=crop&q=80&w=600";

function SupplierGrid() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const query = (searchParams.get("q") ?? "").trim();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Resolve the category name (from SubNav links) to its id.
        let categoryId = null;
        if (category) {
          const categories = await apiGet("/api/categories");
          const match = (Array.isArray(categories) ? categories : []).find(
            (c) => c.category_name === category,
          );
          categoryId = match ? match.category_id : null;
        }

        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (categoryId != null) params.set("category_id", String(categoryId));
        const qs = params.toString();

        const data = await apiGet(`/api/suppliers${qs ? `?${qs}` : ""}`);
        if (!cancelled) {
          setSuppliers(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [category, query]);

  if (loading) {
    return <p className="grid-empty">Loading suppliers…</p>;
  }

  if (error) {
    return (
      <p className="grid-empty">
        Could not load suppliers: {error}. Is the backend running?
      </p>
    );
  }

  return (
    <>
      {(category || query) && (
        <div className="grid-filter-bar">
          <span>
            Showing {suppliers.length} supplier
            {suppliers.length === 1 ? "" : "s"}
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

      {suppliers.length === 0 ? (
        <p className="grid-empty">
          No suppliers found. Try a different search or category.
        </p>
      ) : (
        <section className="content-grid" aria-label="Supplier results">
          {suppliers.map((supplier) => (
            <Link
              to={`/suppliers/${supplier.business_id}`}
              className="supplier-box"
              key={supplier.business_id}
            >
              <div className="supplier-box-image">
                <img
                  src={PLACEHOLDER_IMAGE}
                  alt={`${supplier.business_name} supplier`}
                />
              </div>
              <div className="supplier-box-info">
                <h3>
                  {supplier.business_name}
                  {supplier.is_verified && (
                    <BadgeCheck
                      size={16}
                      className="verified-badge"
                      aria-label="Verified"
                    />
                  )}
                </h3>
                <p>Location: {supplier.city ?? "—"}</p>
                <p>
                  {supplier.product_count} product
                  {supplier.product_count === 1 ? "" : "s"}
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
