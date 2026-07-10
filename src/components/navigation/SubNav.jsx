import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { imageForCategory } from "../../lib/categoryImages";

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
              <img src={imageForCategory(item.category_name, 160)} alt="" aria-hidden="true" />
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
