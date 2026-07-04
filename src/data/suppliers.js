// Shared supplier mock data. Replace with an API call to /api/suppliers later;
// pages only depend on this shape, not on where the data comes from.

export const suppliers = [
  {
    slug: "johns-pork",
    supplier_name: "John's Pork",
    location: "Cebu City",
    rating: 5,
    category: "Pork",
    supplier_image: "https://loremflickr.com/600/700/pork,meat,market",
  },
  {
    slug: "beefy-bros",
    supplier_name: "Beefy Bros",
    location: "Manila",
    rating: 4,
    category: "Beef",
    supplier_image: "https://loremflickr.com/600/700/beef,butcher,market",
  },
  {
    slug: "chicken-coop",
    supplier_name: "Chicken Coop",
    location: "Davao City",
    rating: 4,
    category: "Chicken",
    supplier_image: "https://loremflickr.com/600/700/chicken,poultry,market",
  },
  {
    slug: "chips-r-us",
    supplier_name: "Chips R Us",
    location: "Cagayan de Oro",
    rating: 3,
    category: "Chips",
    supplier_image: "https://loremflickr.com/600/700/chips,snacks,store",
  },
  {
    slug: "fishy-friends",
    supplier_name: "Fishy Friends",
    location: "General Santos City",
    rating: 5,
    category: "Fish",
    supplier_image: "https://loremflickr.com/600/700/fish,seafood,market",
  },
  {
    slug: "toys-r-us",
    supplier_name: "Toys R Us",
    location: "Baguio City",
    rating: 4,
    category: "Packaging",
    supplier_image: "https://loremflickr.com/600/700/toys,shop",
  },
  {
    slug: "produce-paradise",
    supplier_name: "Produce Paradise",
    location: "Iloilo City",
    rating: 5,
    category: "Produce",
    supplier_image: "https://loremflickr.com/600/700/produce,fruits,vegetables",
  },
  {
    slug: "bakery-bliss",
    supplier_name: "Bakery Bliss",
    location: "Bacolod City",
    rating: 4,
    category: "Bakery",
    supplier_image: "https://loremflickr.com/600/700/bakery,bread,cakes",
  },
  {
    slug: "dairy-delights",
    supplier_name: "Dairy Delights",
    location: "Tagaytay City",
    rating: 3,
    category: "Dairy",
    supplier_image: "https://loremflickr.com/600/700/dairy,milk,cheese",
  },
];

export function findSupplier(slug) {
  return suppliers.find((supplier) => supplier.slug === slug) || null;
}
