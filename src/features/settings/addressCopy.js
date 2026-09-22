// Buyers keep a delivery book, wholesalers a pickup / warehouse book.
// A business that carries both roles shares one book and labels each place.

export function addressBookCopy(business) {
  const roles = business?.roles ?? [];
  const type = business?.business_type;
  const buyer = type === "buyer" || roles.includes("buyer");
  const wholesaler = type === "wholesaler" || roles.includes("wholesaler");
  const both = type === "both" || (buyer && wholesaler);

  if (both) {
    return {
      heading: "Addresses",
      intro: "One address book for this business. Label each place. The default is the pin orders and routing use.",
      noun: "address",
      add: "Add address",
      checkoutLabel: "Address",
      modalTitle: "Address",
    };
  }
  if (wholesaler) {
    return {
      heading: "Pickup addresses",
      intro: "Warehouse and pickup locations. The default is the pin used when you ship orders.",
      noun: "pickup / warehouse address",
      add: "Add pickup address",
      checkoutLabel: "Pickup address",
      modalTitle: "Pickup address",
    };
  }
  return {
    heading: "Delivery addresses",
    intro: "Where orders should be delivered. The default is the pin used when you place an order.",
    noun: "delivery address",
    add: "Add delivery address",
    checkoutLabel: "Delivery address",
    modalTitle: "Delivery address",
  };
}

export function formatAddress(loc) {
  if (!loc) return "";
  return [
    loc.street_address,
    loc.barangay,
    loc.city_municipality,
    loc.province,
    loc.postal_code,
  ]
    .filter((part) => part && String(part).trim())
    .join(", ");
}
