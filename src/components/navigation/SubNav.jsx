import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const items = [
  { name: "Pork", image: "https://loremflickr.com/160/160/pork,meat", link: "pork.html" },
  { name: "Beef", image: "https://loremflickr.com/160/160/beef,meat", link: "beef.html" },
  { name: "Chicken", image: "https://loremflickr.com/160/160/chicken,meat", link: "chicken.html" },
  { name: "Chips", image: "https://loremflickr.com/160/160/potato,chips", link: "chips.html" },
  { name: "Fish", image: "https://loremflickr.com/160/160/fish,seafood", link: "fish.html" },
  { name: "Shellfish", image: "https://loremflickr.com/160/160/shellfish,seafood", link: "shellfish.html" },
  { name: "Produce", image: "https://loremflickr.com/160/160/produce,vegetables", link: "produce.html" },
  { name: "Bakery", image: "https://loremflickr.com/160/160/bakery,bread", link: "bakery.html" },
  { name: "Dairy", image: "https://loremflickr.com/160/160/dairy,milk", link: "dairy.html" },
  { name: "Frozen", image: "https://loremflickr.com/160/160/frozen,food", link: "frozen.html" },
  { name: "Packaging", image: "https://loremflickr.com/160/160/food,packaging", link: "packaging.html" },
  { name: "Beverages", image: "https://loremflickr.com/160/160/beverages,drinks", link: "beverages.html" },
];

function SubNav() {
  const containerRef = useRef(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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
  }, []);

  function scrollNav(direction) {
    containerRef.current?.scrollBy({
      left: direction * 300,
      behavior: "smooth",
    });
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
          {items.map((item) => (
            <a className="circle-btn" href={item.link} key={item.name}>
              <img src={item.image} alt="" aria-hidden="true" />
              <span>{item.name}</span>
            </a>
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
