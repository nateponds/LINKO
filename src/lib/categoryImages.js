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

/* Warehouse/storefront stock photos for supplier cards. Businesses have no
   image column, so pick from the pool by id — stable per supplier, varied
   across the grid. */
const SUPPLIER_IMAGES = [
  "https://images.unsplash.com/photo-1553413077-190dd305871c",
  "https://images.unsplash.com/photo-1565891741441-64926e441838",
  "https://images.unsplash.com/photo-1580674285054-bed31e145f59",
  "https://images.unsplash.com/photo-1601598851547-4302969d0614",
  "https://images.unsplash.com/photo-1578916171728-46686eac8d58",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1519566335946-e6f65f0f4fdf",
  "https://images.unsplash.com/photo-1586528116493-a029325540fa",
  "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e",
  "https://images.unsplash.com/photo-1568254183919-78a4f43a2877",
  "https://images.unsplash.com/photo-1595246140625-573b715d11dc",
  "https://images.unsplash.com/photo-1587293852726-70cdb56c2866",
  "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3",
  "https://images.unsplash.com/photo-1542838132-92c53300491e",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
];

export function imageForSupplier(businessId, width = 600) {
  // ponytail: modulo the id — no hashing, ids are already well distributed
  const index = Math.abs(Number(businessId) || 0) % SUPPLIER_IMAGES.length;
  return `${SUPPLIER_IMAGES[index]}?auto=format&fit=crop&q=80&w=${width}`;
}

/* Initial-letter monogram, used when a stock photo fails to load (dead URL,
   offline, blocked host) so a card never renders as a broken tile. */
export function initialOf(name) {
  return (name?.trim()[0] ?? "?").toUpperCase();
}

export function hueOf(name) {
  let sum = 0;
  for (const ch of name ?? "") sum = (sum + ch.charCodeAt(0)) % 360;
  return sum;
}
