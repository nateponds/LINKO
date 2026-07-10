/* Deterministic placeholder image per product/category name, shared by the
   category subnav and any product card that has no image_url of its own. */
const CATEGORY_IMAGES = {
  Pork: "https://images.unsplash.com/photo-1432139555190-58524dae6a55",
  Beef: "https://images.unsplash.com/photo-1546964124-0cce460f38ef",
  Chicken: "https://images.unsplash.com/photo-1587595431973-160d0d94add1",
  Chips: "https://images.unsplash.com/photo-1566478989037-eec170784d0b",
  Fish: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62",
  Shellfish: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47",
  Produce: "https://images.unsplash.com/photo-1610832958506-aa56368176cf",
  Bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff",
  Dairy: "https://images.unsplash.com/photo-1628088062854-d1870b4553da",
  Frozen: "https://images.unsplash.com/photo-1488900128323-21503983a07e",
  Packaging: "https://images.unsplash.com/photo-1607344645866-009c320b63e0",
  Beverages: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97",
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836";

export function imageForCategory(name, width = 400) {
  const base = CATEGORY_IMAGES[name] ?? FALLBACK_IMAGE;
  return `${base}?auto=format&fit=crop&q=80&w=${width}`;
}
