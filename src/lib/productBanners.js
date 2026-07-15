// Promo banner artwork (public/images/productbanners) matched to real product
// rows by name so banner buttons can deep-link to the product's supplier.
// `button` is the pill's position/size as percentages of the banner, tuned per
// image so it sits in the artwork's empty space (and covers the baked-in
// "Button Here" placeholder on images 6-8). Image 9 is a blank export, so it
// is not in the pool.
export const BANNERS = [
  {
    image: "/images/productbanners/1.png",
    alt: "Pure fresh milk, by the crate",
    productMatch: "carabao milk",
    button: { left: "4.4%", bottom: "12%", width: "15%", height: "9.5%", background: "#2c5aa8", color: "#fff" },
  },
  {
    image: "/images/productbanners/2.png",
    alt: "Premium dried squid, sun-dried to perfection",
    productMatch: "dried pusit",
    button: { right: "3.5%", bottom: "12%", width: "15%", height: "9.5%", background: "#5a3f96", color: "#fff" },
  },
  {
    image: "/images/productbanners/3.png",
    alt: "Fresh calamansi juice, zest in every sip",
    productMatch: "calamansi juice",
    button: { left: "5.9%", bottom: "8%", width: "15%", height: "9.5%", background: "#4a8f2f", color: "#fff" },
  },
  {
    image: "/images/productbanners/4.png",
    alt: "Plump tiger prawns, fresh off the boat",
    productMatch: "tiger prawns",
    button: { right: "5.5%", bottom: "13%", width: "15%", height: "9.5%", background: "#a65b32", color: "#fff" },
  },
  {
    image: "/images/productbanners/5.png",
    alt: "Krispy chicharon, sarap for all",
    productMatch: "chicharon baboy",
    button: { left: "6%", bottom: "6.5%", width: "15%", height: "9.5%", background: "#c14b57", color: "#fff" },
  },
  {
    image: "/images/productbanners/6.png",
    alt: "Krispy chicharon, sarap for all",
    productMatch: "chicharon baboy",
    button: { left: "4.2%", bottom: "8.9%", width: "16%", height: "9.6%", background: "#f5b940", color: "#4a2a12" },
  },
  {
    image: "/images/productbanners/7.png",
    alt: "Sweet ripe mangoes, goodness in every bite",
    productMatch: "carabao mango",
    button: { left: "4.4%", bottom: "14.1%", width: "15.8%", height: "9.9%", background: "#e8872d", color: "#fff" },
  },
  {
    image: "/images/productbanners/8.png",
    alt: "Pure fresh milk, by the crate",
    productMatch: "carabao milk",
    button: { left: "5.7%", bottom: "14.9%", width: "15.7%", height: "9.9%", background: "#4a72c4", color: "#fff" },
  },
];

export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Pick `count` banners advertising distinct products (some products have two
// banner variants), choosing randomly among variants, so the slots never
// promote the same thing twice and the selection changes between visits.
export function pickRandomBanners(count) {
  const byProduct = new Map();
  for (const banner of shuffle(BANNERS)) {
    if (!byProduct.has(banner.productMatch)) {
      byProduct.set(banner.productMatch, banner);
    }
  }
  return shuffle([...byProduct.values()]).slice(0, count);
}

export function productForBanner(banner, products) {
  return products.find((item) =>
    item.product_name?.toLowerCase().includes(banner.productMatch),
  );
}

// Banners advertising any of the given products (used by the supplier profile
// to show that supplier's own artwork). Returns them in random order.
export function bannersForProducts(products) {
  return shuffle(
    BANNERS.filter((banner) => productForBanner(banner, products)),
  );
}
