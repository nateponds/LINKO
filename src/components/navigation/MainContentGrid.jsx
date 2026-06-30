const suppliers = [
  {
    supplier_name: "John's Pork",
    location: "Cebu City",
    rating: 5,
    supplier_image: "https://loremflickr.com/600/700/pork,meat,market",
  },
  {
    supplier_name: "Beefy Bros",
    location: "Manila",
    rating: 4,
    supplier_image: "https://loremflickr.com/600/700/beef,butcher,market",
  },
  {
    supplier_name: "Chicken Coop",
    location: "Davao City",
    rating: 4,
    supplier_image: "https://loremflickr.com/600/700/chicken,poultry,market",
  },
  {
    supplier_name: "Chips R Us",
    location: "Cagayan de Oro",
    rating: 3,
    supplier_image: "https://loremflickr.com/600/700/chips,snacks,store",
  },
  {
    supplier_name: "Fishy Friends",
    location: "General Santos City",
    rating: 5,
    supplier_image: "https://loremflickr.com/600/700/fish,seafood,market",
  },
  {
    supplier_name: "Toys R Us",
    location: "Baguio City",
    rating: 4,
    supplier_image: "https://loremflickr.com/600/700/toys,shop",
  },
  {
    supplier_name: "Produce Paradise",
    location: "Iloilo City",
    rating: 5,
    supplier_image: "https://loremflickr.com/600/700/produce,fruits,vegetables",
  },
  {
    supplier_name: "Bakery Bliss",
    location: "Bacolod City",
    rating: 4,
    supplier_image: "https://loremflickr.com/600/700/bakery,bread,cakes",
  },
  {
    supplier_name: "Dairy Delights",
    location: "Tagaytay City",
    rating: 3,
    supplier_image: "https://loremflickr.com/600/700/dairy,milk,cheese",
  },
];

function MainContentGrid() {
  return (
    <section className="content-grid" aria-label="Supplier results">
      {suppliers.map((supplier) => (
        <article className="supplier-box" key={supplier.supplier_name}>
          <div className="supplier-box-image">
            <img
              src={supplier.supplier_image}
              alt={`${supplier.supplier_name} supplier`}
            />
          </div>
          <div className="supplier-box-info">
            <h3>{supplier.supplier_name}</h3>
            <p>Location: {supplier.location}</p>
            <p>
              Rating: {"★".repeat(supplier.rating)}
              {"☆".repeat(5 - supplier.rating)}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

export default MainContentGrid;
