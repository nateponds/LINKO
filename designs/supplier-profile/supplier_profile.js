function toggleMenu() {
  const menu = document.getElementById("menuOverlay");
  if (menu.style.width === "250px") {
    menu.style.width = "0";
  } else {
    menu.style.width = "250px";
  }
}

// Follow button toggle
const followBtn = document.getElementById("followBtn");
followBtn.addEventListener("click", () => {
  const following = followBtn.classList.toggle("following");
  followBtn.innerHTML = following
    ? "Following <span class=\"plus\">✓</span>"
    : "Follow <span class=\"plus\">+</span>";
});

// Tab switching
const tabButtons = document.querySelectorAll(".tab-btn");
const grid = document.getElementById("productGrid");
const categoryGrid = document.getElementById("categoryGrid");
const shopSection = document.getElementById("shopSection");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    shopSection.style.display   = btn.dataset.tab === "shop"        ? "block" : "none";
    grid.style.display          = btn.dataset.tab === "products"    ? "grid"  : "none";
    categoryGrid.style.display  = btn.dataset.tab === "categories"  ? "grid"  : "none";

    if (btn.dataset.tab === "products") {
      document.querySelectorAll(".product-card").forEach(card => {
        card.style.display = "flex";
      });
    }

    if (btn.dataset.tab === "categories") {
      grid.style.display = "none";
      categoryBackBar.style.display = "none";
    }
  });
});

// Shop is visible on load, others hidden
shopSection.style.display  = "block";
grid.style.display         = "none";
categoryGrid.style.display = "none";

// "Browse Products →" CTA switches to Products tab
document.querySelector(".shop-hero-cta").addEventListener("click", () => {
  tabButtons.forEach(b => b.classList.remove("active"));
  document.querySelector("[data-tab='products']").classList.add("active");
  shopSection.style.display  = "none";
  grid.style.display         = "grid";
  categoryGrid.style.display = "none";
  document.querySelectorAll(".product-card").forEach(c => c.style.display = "flex");
});

// Placeholder categories
const categories = [
  { name: "Breads & Bakery",    icon: "🍞" },
  { name: "Beverages",          icon: "🥤" },
  { name: "Dairy & Eggs",       icon: "🥚" },
  { name: "Snacks",             icon: "🍿" },
  { name: "Canned & Packaged",  icon: "🥫" },
  { name: "Coffee & Tea",       icon: "☕" },
];

const categoryBackBar = document.getElementById("categoryBackBar");
const categoryBackBtn = document.getElementById("categoryBackBtn");

// Back button — return to category grid
categoryBackBtn.addEventListener("click", () => {
  grid.style.display = "none";
  categoryBackBar.style.display = "none";
  categoryGrid.style.display = "grid";
});

categories.forEach(cat => {
  const card = document.createElement("div");
  card.className = "category-card";
  card.innerHTML = `
    <div class="category-icon">${cat.icon}</div>
    <div class="category-name">${cat.name}</div>
  `;

  card.addEventListener("click", () => {
    // Hide categories, show back button and filtered products
    categoryGrid.style.display = "none";
    categoryBackBar.style.display = "block";
    grid.style.display = "grid";

    document.querySelectorAll(".product-card").forEach(c => {
      c.style.display = c.dataset.category === cat.name ? "flex" : "none";
    });
  });

  categoryGrid.appendChild(card);
});

// Products with hidden category tags (stored as data-category attribute only)
const products = [
  { name: "Whole Grain Bread",       price: 85,  category: "Breads & Bakery"   },
  { name: "Fresh Orange Juice 1L",   price: 120, category: "Beverages"          },
  { name: "Organic Eggs (12pcs)",    price: 150, category: "Dairy & Eggs"       },
  { name: "Cheddar Cheese Block",    price: 220, category: "Dairy & Eggs"       },
  { name: "Sparkling Water 6-Pack",  price: 180, category: "Beverages"          },
  { name: "Roasted Coffee Beans 250g", price: 280, category: "Coffee & Tea"     },
];

products.forEach(p => {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.category = p.category; // hidden from UI, available for filtering later
  card.innerHTML = `
    <div class="product-image"></div>
    <div class="product-details">
      <div class="product-name">${p.name}</div>
      <div class="product-price">₱${p.price.toFixed(2)}</div>
    </div>
  `;
  grid.appendChild(card);
});