import { ArrowLeft, ArrowRight, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { iconForCategory } from "../../lib/categoryIcons";

function SubNav() {
  const containerRef = useRef(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let cancelled = false;

    apiGet("/api/categories")
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateScrollButtons() {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    setCanScrollBack(container.scrollLeft > 0);
    setCanScrollNext(
      container.scrollLeft + container.clientWidth < container.scrollWidth - 10,
    );
  }

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);

    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [categories]);

  function scrollNav(direction) {
    containerRef.current?.scrollBy({
      left: direction * 300,
      behavior: "smooth",
    });
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <nav className="sub-nav-wrapper">
      <button
        className="nav-arrow"
        type="button"
        onClick={() => scrollNav(-1)}
        disabled={!canScrollBack}
        aria-label="Scroll categories backward"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="category-row" ref={containerRef} onScroll={updateScrollButtons}>
        {categories.map((item, index) => {
          const Icon = iconForCategory(item.category_name);
          return (
            <div className="category-item-wrap" key={item.category_id}>
              <Link
                className="category-pill"
                to={`/?category=${encodeURIComponent(item.category_name)}`}
              >
                <span className="category-icon-circle">
                  <Icon size={24} strokeWidth={1.75} />
                </span>
                <span className="category-text">
                  <span className="category-name">{item.category_name}</span>
                  <span className="category-count">
                    {item.product_count ?? 0} Product{item.product_count === 1 ? "" : "s"}
                  </span>
                </span>
              </Link>
              {index < categories.length - 1 && (
                <MoreVertical size={16} className="category-divider" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      <button
        className="nav-arrow"
        type="button"
        onClick={() => scrollNav(1)}
        disabled={!canScrollNext}
        aria-label="Scroll categories forward"
      >
        <ArrowRight size={20} />
      </button>
    </nav>
  );
}

export default SubNav;
