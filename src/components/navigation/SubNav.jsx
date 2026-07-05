import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";

/* Deterministic placeholder image per category name. Categories not listed
   fall back to a generic food image so the carousel always renders. */
const CATEGORY_IMAGES = {
  Pork: "https://loremflickr.com/160/160/pork,meat",
  Beef: "https://loremflickr.com/160/160/beef,meat",
  Chicken: "https://loremflickr.com/160/160/chicken,meat",
  Chips: "https://loremflickr.com/160/160/potato,chips",
  Fish: "https://loremflickr.com/160/160/fish,seafood",
  Shellfish: "https://loremflickr.com/160/160/shellfish,seafood",
  Produce: "https://loremflickr.com/160/160/produce,vegetables",
  Bakery: "https://loremflickr.com/160/160/bakery,bread",
  Dairy: "https://loremflickr.com/160/160/dairy,milk",
  Frozen: "https://loremflickr.com/160/160/frozen,food",
  Packaging: "https://loremflickr.com/160/160/food,packaging",
  Beverages: "https://loremflickr.com/160/160/beverages,drinks",
};

function imageFor(name) {
  return (
    CATEGORY_IMAGES[name] ??
    `https://loremflickr.com/160/160/${encodeURIComponent(name.toLowerCase())},food`
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
