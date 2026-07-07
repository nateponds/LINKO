import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";

/* Deterministic placeholder image per category name. Categories not listed
   fall back to a generic food image so the carousel always renders. */
const CATEGORY_IMAGES = {
  Pork: "https://images.unsplash.com/photo-1602491453631-e2a5690cd108?auto=format&fit=crop&q=80&w=160",
  Beef: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?auto=format&fit=crop&q=80&w=160",
  Chicken: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?auto=format&fit=crop&q=80&w=160",
  Chips: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=160",
  Fish: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&q=80&w=160",
  Shellfish: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&q=80&w=160",
  Produce: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=160",
  Bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=160",
  Dairy: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&q=80&w=160",
  Frozen: "https://images.unsplash.com/photo-1571168128452-527027d11822?auto=format&fit=crop&q=80&w=160",
  Packaging: "https://images.unsplash.com/photo-1607344645866-009c320b63e0?auto=format&fit=crop&q=80&w=160",
  Beverages: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=160",
};

function imageFor(name) {
  return (
    CATEGORY_IMAGES[name] ??
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=160"
  );
}

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
    <>
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

        <div className="circle-container" ref={containerRef} onScroll={updateScrollButtons}>
          {categories.map((item) => (
            <Link
              className="circle-btn"
              to={`/?category=${encodeURIComponent(item.category_name)}`}
              key={item.category_id}
            >
              <img src={imageFor(item.category_name)} alt="" aria-hidden="true" />
              <span>{item.category_name}</span>
            </Link>
          ))}
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
    </>
  );
}

export default SubNav;
